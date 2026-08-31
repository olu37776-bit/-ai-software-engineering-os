import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { relative, resolve, sep } from "node:path";

import { canonicalJsonSha256 } from "@aseos/contracts";

import { ControlApiError, redactForPublicBoundary } from "./errors.js";
import {
  acquireRuntimeLock,
  controlPaths,
  createSecureToken,
  removeControlFiles,
  writeDescriptor,
} from "./filesystem.js";
import { BoundedIdempotencyRegistry } from "./idempotency.js";
import { createUuidV7 } from "./identity.js";
import type {
  BoundedControlMetadata,
  ControlApiLimits,
  ControlApiRuntime,
  ControlEndpointDescriptor,
  ControlNotification,
  DiagnosticFinding,
  ProblemDetails,
  PublishNotificationInput,
  RequestIdentity,
  StartControlApiOptions,
} from "./types.js";

const DEFAULT_LIMITS: ControlApiLimits = Object.freeze({
  maxHeaderBytes: 16 * 1024,
  maxUrlBytes: 2 * 1024,
  maxBodyBytes: 16 * 1024,
  maxResponseBytes: 256 * 1024,
  maxConcurrentRequests: 64,
  requestTimeoutMs: 10_000,
  authFailureCapacity: 20,
  authFailureWindowMs: 60_000,
  idempotencyCapacity: 1_024,
  idempotencyTtlMs: 15 * 60_000,
  sseConnectionCapacity: 8,
  sseRetentionCapacity: 512,
  sseHeartbeatMs: 15_000,
  sseMaxBufferedBytes: 256 * 1024,
});

interface AuthFailureState {
  count: number;
  resetAt: number;
}

interface EventConnection {
  readonly response: ServerResponse;
  bufferedBytes: number;
  heartbeat?: NodeJS.Timeout;
}

interface ServerState {
  readonly instanceId: string;
  readonly startedAt: string;
  tokenHash: Buffer;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly limits: ControlApiLimits;
  readonly idempotency: BoundedIdempotencyRegistry;
  readonly authFailures: Map<string, AuthFailureState>;
  readonly notifications: ControlNotification[];
  readonly eventConnections: Set<EventConnection>;
  sequence: number;
  activeRequests: number;
  stopRequested: boolean;
  securityFinding: DiagnosticFinding | undefined;
  securityFindingExpiresAt: number | undefined;
}

function mergeLimits(input: Partial<ControlApiLimits> | undefined): ControlApiLimits {
  const result = { ...DEFAULT_LIMITS, ...input };
  for (const [name, value] of Object.entries(result)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new RangeError(`${name} must be a positive safe integer`);
    }
  }
  return Object.freeze(result);
}

function normalizedOrigins(origins: readonly string[] | undefined): ReadonlySet<string> {
  const result = new Set<string>();
  for (const candidate of origins ?? []) {
    const url = new URL(candidate);
    if (url.username !== "" || url.password !== "" || url.origin !== candidate) {
      throw new ControlApiError(
        "CONTROL_ORIGIN_INVALID",
        "Allowed origins must be exact URL origins",
      );
    }
    result.add(candidate);
  }
  return result;
}

function identity(request: IncomingMessage): RequestIdentity {
  const valid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
  const requestIdHeader = request.headers["x-request-id"];
  const correlationIdHeader = request.headers["x-correlation-id"];
  const requestId =
    typeof requestIdHeader === "string" && valid.test(requestIdHeader)
      ? requestIdHeader
      : createUuidV7();
  const correlationId =
    typeof correlationIdHeader === "string" && valid.test(correlationIdHeader)
      ? correlationIdHeader
      : requestId;
  return Object.freeze({ requestId, correlationId });
}

function exactHostHeader(request: IncomingMessage, expected: string): boolean {
  const hosts: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === "host") {
      const value = request.rawHeaders[index + 1];
      if (value !== undefined) hosts.push(value);
    }
  }
  return hosts.length === 1 && hosts[0] === expected && request.headers.host === expected;
}

function validSubjectRef(value: unknown): value is PublishNotificationInput["subjectRef"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const subject = value as Record<string, unknown>;
  const keys = Object.keys(subject);
  return (
    (keys.length === 2 || (keys.length === 3 && typeof subject["subjectVersion"] === "string")) &&
    typeof subject["subjectType"] === "string" &&
    /^[A-Z][A-Za-z0-9]{1,127}$/u.test(subject["subjectType"]) &&
    typeof subject["subjectId"] === "string" &&
    subject["subjectId"].length >= 1 &&
    subject["subjectId"].length <= 256 &&
    (subject["subjectVersion"] === undefined ||
      (typeof subject["subjectVersion"] === "string" &&
        subject["subjectVersion"].length >= 1 &&
        subject["subjectVersion"].length <= 128))
  );
}

function problem(
  ids: RequestIdentity,
  status: number,
  code: string,
  title: string,
  detail: string,
  retryability: ProblemDetails["retryability"] = "NON_RETRYABLE",
): ProblemDetails {
  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    type: `https://aseos.local/problems/${code.toLowerCase().replaceAll("_", "-")}`,
    title,
    status,
    detail: redactForPublicBoundary(detail),
    code,
    category:
      status >= 500
        ? status === 504
          ? "TIMEOUT"
          : "UNAVAILABLE"
        : status === 409 || status === 412
          ? "CONFLICT"
          : status === 401
            ? "AUTHENTICATION"
            : status === 403 || status === 429
              ? "AUTHORIZATION"
              : "VALIDATION",
    retryability,
    requestId: ids.requestId,
    correlationId: ids.correlationId,
    subjectRef: Object.freeze({ subjectType: "ControlRequest", subjectId: ids.requestId }),
    remediation:
      status === 401
        ? "Reload the runtime descriptor and token, then retry."
        : "Correct the request and retry.",
  });
}

function applyOriginHeaders(response: ServerResponse, origin: string | undefined): void {
  if (origin === undefined) return;
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader(
    "access-control-allow-headers",
    "authorization,content-type,idempotency-key,if-match,x-request-id,x-correlation-id,last-event-id",
  );
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("vary", "Origin");
}

const PREFLIGHT_HEADERS = new Set([
  "authorization",
  "content-type",
  "idempotency-key",
  "if-match",
  "last-event-id",
  "x-correlation-id",
  "x-request-id",
]);

function validPreflight(request: IncomingMessage, pathname: string): boolean {
  const requestedMethod = request.headers["access-control-request-method"];
  const expectedMethod = pathname === "/v1/runtime/stop" ? "POST" : "GET";
  if (requestedMethod !== expectedMethod) return false;
  const requestedHeaders = request.headers["access-control-request-headers"];
  if (requestedHeaders === undefined) return true;
  if (Array.isArray(requestedHeaders)) return false;
  const names = requestedHeaders
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => PREFLIGHT_HEADERS.has(name));
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  maxBytes: number,
  contentType = "application/json",
): void {
  const content = JSON.stringify(value);
  if (Buffer.byteLength(content) > maxBytes) {
    response.statusCode = 500;
    response.setHeader("cache-control", "no-store");
    response.setHeader("connection", "close");
    response.setHeader("content-length", 0);
    response.end();
    return;
  }
  response.statusCode = status;
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", `${contentType}; charset=utf-8`);
  response.setHeader("content-length", Buffer.byteLength(content));
  response.end(content);
}

function tokenMatches(header: string | undefined, expectedHash: Buffer): boolean {
  if (header?.startsWith("Bearer ") !== true) return false;
  const candidate = header.slice(7);
  const candidateHash = createHash("sha256").update(candidate, "utf8").digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

function registerAuthFailure(
  state: ServerState,
  remote: string,
): Readonly<{ limited: boolean; retryAfter: number }> {
  const now = Date.now();
  let entry = state.authFailures.get(remote);
  if (entry === undefined || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + state.limits.authFailureWindowMs };
    if (state.authFailures.size >= 32) {
      const oldest = state.authFailures.keys().next().value;
      if (oldest !== undefined) state.authFailures.delete(oldest);
    }
    state.authFailures.set(remote, entry);
  }
  entry.count += 1;
  return Object.freeze({
    limited: entry.count > state.limits.authFailureCapacity,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  });
}

function metadata(state: ServerState): BoundedControlMetadata {
  return Object.freeze({
    authenticationRateLimit: Object.freeze({
      capacity: state.limits.authFailureCapacity,
      windowMs: state.limits.authFailureWindowMs,
    }),
    idempotency: Object.freeze({
      capacity: state.limits.idempotencyCapacity,
      ttlMs: state.limits.idempotencyTtlMs,
      entries: state.idempotency.size,
    }),
    sse: Object.freeze({
      connectionCapacity: state.limits.sseConnectionCapacity,
      activeConnections: state.eventConnections.size,
      retentionCapacity: state.limits.sseRetentionCapacity,
      retainedNotifications: state.notifications.length,
      heartbeatMs: state.limits.sseHeartbeatMs,
    }),
  });
}

function securityFindings(state: ServerState): readonly DiagnosticFinding[] {
  if (
    state.securityFinding !== undefined &&
    state.securityFindingExpiresAt !== undefined &&
    state.securityFindingExpiresAt <= Date.now()
  ) {
    state.securityFinding = undefined;
    state.securityFindingExpiresAt = undefined;
  }
  return state.securityFinding === undefined ? [] : [state.securityFinding];
}

async function rejectUnexpectedBody(request: IncomingMessage, limit: number): Promise<void> {
  let bytes = 0;
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk as Uint8Array);
    if (bytes > limit)
      throw new ControlApiError("CONTROL_BODY_TOO_LARGE", "Request body limit exceeded");
  }
  if (bytes !== 0)
    throw new ControlApiError("CONTROL_BODY_NOT_ALLOWED", "This endpoint does not accept a body");
}

function writeSseFrame(connection: EventConnection, data: string, maxBuffered: number): boolean {
  const bytes = Buffer.byteLength(data);
  if (connection.bufferedBytes + bytes > maxBuffered) return false;
  connection.bufferedBytes += bytes;
  const writable = connection.response.write(data, () => {
    connection.bufferedBytes = Math.max(0, connection.bufferedBytes - bytes);
  });
  return writable || connection.bufferedBytes <= maxBuffered;
}

function writeSse(
  connection: EventConnection,
  notification: ControlNotification,
  maxBuffered: number,
): boolean {
  return writeSseFrame(
    connection,
    `id: ${notification.notificationId}\nevent: ${notification.kind}\ndata: ${JSON.stringify(notification)}\n\n`,
    maxBuffered,
  );
}

function closeEventConnection(state: ServerState, connection: EventConnection): void {
  if (connection.heartbeat !== undefined) clearInterval(connection.heartbeat);
  state.eventConnections.delete(connection);
  if (!connection.response.writableEnded) connection.response.end();
}

function serveEvents(
  request: IncomingMessage,
  response: ServerResponse,
  state: ServerState,
  ids: RequestIdentity,
): void {
  if (state.eventConnections.size >= state.limits.sseConnectionCapacity) {
    sendJson(
      response,
      503,
      problem(
        ids,
        503,
        "CONTROL_SSE_CAPACITY",
        "SSE capacity reached",
        "Too many event streams are active",
        "RETRYABLE",
      ),
      state.limits.maxResponseBytes,
      "application/problem+json",
    );
    return;
  }
  response.statusCode = 200;
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("connection", "keep-alive");
  response.flushHeaders();
  const connection: EventConnection = { response, bufferedBytes: 0 };
  connection.heartbeat = setInterval(() => {
    if (!writeSseFrame(connection, ": heartbeat\n\n", state.limits.sseMaxBufferedBytes))
      closeEventConnection(state, connection);
  }, state.limits.sseHeartbeatMs);
  connection.heartbeat.unref();
  state.eventConnections.add(connection);
  const lastId = request.headers["last-event-id"];
  if (typeof lastId === "string" && state.notifications.length > 0) {
    const index = state.notifications.findIndex((item) => item.notificationId === lastId);
    if (index < 0) {
      if (
        !writeSseFrame(
          connection,
          'event: gap\ndata: {"code":"CONTROL_SSE_RETENTION_GAP"}\n\n',
          state.limits.sseMaxBufferedBytes,
        )
      ) {
        closeEventConnection(state, connection);
        return;
      }
    } else {
      for (const notification of state.notifications.slice(index + 1)) {
        if (!writeSse(connection, notification, state.limits.sseMaxBufferedBytes)) {
          closeEventConnection(state, connection);
          return;
        }
      }
    }
  }
  const release = (): void => {
    closeEventConnection(state, connection);
  };
  request.once("close", release);
  response.once("close", release);
}

function createRequestHandler(
  state: ServerState,
  descriptor: () => ControlEndpointDescriptor,
  requestStop: () => void,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response): void => {
    const ids = identity(request);
    response.setHeader("x-request-id", ids.requestId);
    response.setHeader("x-correlation-id", ids.correlationId);
    const timer = setTimeout(() => {
      if (!response.writableEnded)
        sendJson(
          response,
          504,
          problem(
            ids,
            504,
            "CONTROL_REQUEST_TIMEOUT",
            "Request timed out",
            "The request exceeded its execution budget",
            "RETRYABLE",
          ),
          state.limits.maxResponseBytes,
          "application/problem+json",
        );
    }, state.limits.requestTimeoutMs);
    timer.unref();
    response.once("close", () => {
      clearTimeout(timer);
    });
    const run = async (): Promise<void> => {
      const urlText = request.url ?? "";
      if (Buffer.byteLength(urlText) > state.limits.maxUrlBytes) {
        sendJson(
          response,
          414,
          problem(
            ids,
            414,
            "CONTROL_URL_TOO_LONG",
            "URL too long",
            "The request target exceeded its limit",
          ),
          state.limits.maxResponseBytes,
          "application/problem+json",
        );
        return;
      }
      if (state.activeRequests >= state.limits.maxConcurrentRequests) {
        sendJson(
          response,
          503,
          problem(
            ids,
            503,
            "CONTROL_CONCURRENCY_LIMIT",
            "Runtime busy",
            "The request concurrency limit was reached",
            "RETRYABLE",
          ),
          state.limits.maxResponseBytes,
          "application/problem+json",
        );
        return;
      }
      state.activeRequests += 1;
      try {
        const current = descriptor();
        if (
          request.socket.localAddress !== "127.0.0.1" ||
          !exactHostHeader(request, `127.0.0.1:${String(current.port)}`)
        ) {
          sendJson(
            response,
            400,
            problem(
              ids,
              400,
              "CONTROL_HOST_REJECTED",
              "Host rejected",
              "Host must identify the active loopback endpoint",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
          return;
        }
        const origin = request.headers.origin;
        if (Array.isArray(origin) || (origin !== undefined && !state.allowedOrigins.has(origin))) {
          sendJson(
            response,
            403,
            problem(
              ids,
              403,
              "CONTROL_ORIGIN_REJECTED",
              "Origin rejected",
              "The browser origin is not registered",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
          return;
        }
        const url = new URL(urlText, `http://127.0.0.1:${String(current.port)}`);
        if (url.search !== "") {
          sendJson(
            response,
            400,
            problem(
              ids,
              400,
              "CONTROL_QUERY_REJECTED",
              "Query rejected",
              "This endpoint does not accept query parameters",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
          return;
        }
        if (request.method === "OPTIONS") {
          if (
            typeof origin !== "string" ||
            !validPreflight(request, url.pathname) ||
            ![
              "/v1/version",
              "/v1/health",
              "/v1/endpoint",
              "/v1/status",
              "/v1/doctor",
              "/v1/events",
              "/v1/runtime/stop",
            ].includes(url.pathname)
          ) {
            sendJson(
              response,
              403,
              problem(
                ids,
                403,
                "CONTROL_PREFLIGHT_REJECTED",
                "Preflight rejected",
                "The browser preflight is not allowed",
              ),
              state.limits.maxResponseBytes,
              "application/problem+json",
            );
            return;
          }
          applyOriginHeaders(response, origin);
          response.statusCode = 204;
          response.end();
          return;
        }
        if (!tokenMatches(request.headers.authorization, state.tokenHash)) {
          const failure = registerAuthFailure(state, request.socket.remoteAddress ?? "unknown");
          if (failure.limited) response.setHeader("retry-after", failure.retryAfter);
          const status = failure.limited ? 429 : 401;
          if (
            failure.limited &&
            (state.securityFinding === undefined ||
              (state.securityFindingExpiresAt ?? 0) <= Date.now())
          ) {
            state.securityFinding = Object.freeze({
              schemaVersion: "1.0.0",
              findingId: createUuidV7(),
              code: "CONTROL_AUTH_FAILURE_RATE_LIMITED",
              severity: "WARNING",
              subjectRef: Object.freeze({
                subjectType: "Runtime",
                subjectId: state.instanceId,
              }),
              evidenceRefs: [],
              remediation: "Inspect local clients and rotate the runtime token by restarting.",
              detectedAt: new Date().toISOString(),
            });
            state.securityFindingExpiresAt = Date.now() + state.limits.authFailureWindowMs;
          }
          sendJson(
            response,
            status,
            problem(
              ids,
              status,
              failure.limited ? "CONTROL_AUTH_RATE_LIMITED" : "CONTROL_AUTH_REQUIRED",
              failure.limited ? "Authentication rate limited" : "Authentication required",
              "A valid bearer token is required",
              failure.limited ? "RETRYABLE" : "NON_RETRYABLE",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
          return;
        }
        if (typeof origin === "string") applyOriginHeaders(response, origin);
        await rejectUnexpectedBody(request, state.limits.maxBodyBytes);
        const contentType = request.headers["content-type"];
        if (contentType !== undefined && contentType !== "application/json") {
          sendJson(
            response,
            415,
            problem(
              ids,
              415,
              "CONTROL_CONTENT_TYPE_UNSUPPORTED",
              "Content type unsupported",
              "Only application/json is supported",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
          return;
        }
        if (request.method === "GET" && url.pathname === "/v1/version") {
          sendJson(
            response,
            200,
            {
              schemaVersion: "1.0.0",
              apiVersion: "v1",
              frameworkVersion: current.frameworkVersion,
              releaseId: current.releaseId,
              instanceId: current.instanceId,
              ...ids,
            },
            state.limits.maxResponseBytes,
          );
        } else if (request.method === "GET" && url.pathname === "/v1/health") {
          const findings = securityFindings(state);
          sendJson(
            response,
            200,
            {
              schemaVersion: "1.0.0",
              instanceId: current.instanceId,
              readiness: findings.length === 0 ? "READY" : "DEGRADED",
              runtimeVersion: current.frameworkVersion,
              releaseId: current.releaseId,
              stateVersion: 0,
              checkedAt: new Date().toISOString(),
              findings,
            },
            state.limits.maxResponseBytes,
          );
        } else if (request.method === "GET" && url.pathname === "/v1/endpoint") {
          sendJson(response, 200, current, state.limits.maxResponseBytes);
        } else if (request.method === "GET" && url.pathname === "/v1/status") {
          sendJson(
            response,
            200,
            {
              schemaVersion: "1.0.0",
              status: "READY",
              instanceId: current.instanceId,
              uptimeMs: Math.max(0, Date.now() - Date.parse(current.startedAt)),
              limits: metadata(state),
              ...ids,
            },
            state.limits.maxResponseBytes,
          );
        } else if (request.method === "GET" && url.pathname === "/v1/doctor") {
          const findings = securityFindings(state);
          sendJson(
            response,
            200,
            {
              schemaVersion: "1.0.0",
              status: findings.length === 0 ? "PASS" : "FINDINGS",
              findings,
              ...ids,
            },
            state.limits.maxResponseBytes,
          );
        } else if (request.method === "GET" && url.pathname === "/v1/events") {
          clearTimeout(timer);
          serveEvents(request, response, state, ids);
        } else if (request.method === "POST" && url.pathname === "/v1/runtime/stop") {
          const key = request.headers["idempotency-key"];
          if (typeof key !== "string" || !/^[A-Za-z0-9._:/+-]{16,256}$/u.test(key)) {
            sendJson(
              response,
              400,
              problem(
                ids,
                400,
                "CONTROL_IDEMPOTENCY_KEY_REQUIRED",
                "Idempotency key required",
                "A valid Idempotency-Key header is required",
              ),
              state.limits.maxResponseBytes,
              "application/problem+json",
            );
            return;
          }
          if (request.headers["if-match"] === undefined) {
            sendJson(
              response,
              428,
              problem(
                ids,
                428,
                "CONTROL_PRECONDITION_REQUIRED",
                "Runtime identity precondition required",
                "If-Match must identify the active runtime instance",
              ),
              state.limits.maxResponseBytes,
              "application/problem+json",
            );
            return;
          }
          if (request.headers["if-match"] !== `"${current.instanceId}"`) {
            sendJson(
              response,
              412,
              problem(
                ids,
                412,
                "CONTROL_INSTANCE_VERSION_MISMATCH",
                "Runtime identity precondition failed",
                "If-Match must identify the active runtime instance",
              ),
              state.limits.maxResponseBytes,
              "application/problem+json",
            );
            return;
          }
          const payloadHash = canonicalJsonSha256({
            action: "runtime.stop",
            instanceId: current.instanceId,
          });
          const lookup = state.idempotency.lookup(key, payloadHash);
          const operationId = lookup.outcome === "REPLAY" ? lookup.resultIdentity : createUuidV7();
          if (lookup.outcome === "CONFLICT") {
            sendJson(
              response,
              409,
              problem(
                ids,
                409,
                "CONTROL_IDEMPOTENCY_CONFLICT",
                "Idempotency conflict",
                "The key was already used with another payload",
              ),
              state.limits.maxResponseBytes,
              "application/problem+json",
            );
            return;
          }
          state.idempotency.record(key, payloadHash, operationId);
          response.once("finish", () => setImmediate(requestStop));
          sendJson(
            response,
            202,
            {
              schemaVersion: "1.0.0",
              operationId,
              type: "RuntimeStop",
              status: "ACCEPTED",
              resourceUri: `/v1/operations/${operationId}`,
              evidenceRefs: [],
            },
            state.limits.maxResponseBytes,
          );
        } else {
          sendJson(
            response,
            404,
            problem(
              ids,
              404,
              "CONTROL_ROUTE_NOT_FOUND",
              "Route not found",
              "The versioned endpoint does not exist",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
        }
      } catch (error) {
        const code = error instanceof ControlApiError ? error.code : "CONTROL_INTERNAL_ERROR";
        const status =
          code === "CONTROL_BODY_TOO_LARGE" ? 413 : code === "CONTROL_BODY_NOT_ALLOWED" ? 400 : 500;
        if (!response.writableEnded)
          sendJson(
            response,
            status,
            problem(
              ids,
              status,
              code,
              "Request failed",
              error instanceof Error ? error.message : "Unexpected request failure",
            ),
            state.limits.maxResponseBytes,
            "application/problem+json",
          );
      } finally {
        state.activeRequests -= 1;
      }
    };
    void run();
  };
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
  const address = server.address();
  if (
    address === null ||
    typeof address === "string" ||
    address.address !== "127.0.0.1" ||
    address.family !== "IPv4"
  ) {
    throw new ControlApiError(
      "CONTROL_BIND_UNSAFE",
      "Server did not bind the required IPv4 loopback endpoint",
    );
  }
  return address.port;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    server.close((error) => {
      if (error === undefined) resolvePromise();
      else reject(error);
    });
    server.closeAllConnections();
  });
}

export async function startControlApi(options: StartControlApiOptions): Promise<ControlApiRuntime> {
  if (
    options.dataRoot.trim() === "" ||
    !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      options.frameworkVersion,
    ) ||
    options.releaseId.length < 1 ||
    options.releaseId.length > 256
  ) {
    throw new ControlApiError(
      "CONTROL_START_OPTIONS_INVALID",
      "Required runtime identity options are invalid",
    );
  }
  const root = resolve(options.dataRoot);
  const paths = controlPaths(root);
  const limits = mergeLimits(options.limits);
  const instanceId = createUuidV7();
  const startedAt = new Date().toISOString();
  const releaseLock = await acquireRuntimeLock(root, instanceId);
  let server: Server | undefined;
  let descriptorValue: ControlEndpointDescriptor | undefined;
  let stopped: Promise<void> | undefined;
  let resolveClosed: (() => void) | undefined;
  const closed = new Promise<void>((resolvePromise) => {
    resolveClosed = resolvePromise;
  });
  const state: ServerState = {
    instanceId,
    startedAt,
    tokenHash: Buffer.alloc(32),
    allowedOrigins: normalizedOrigins(options.allowedOrigins),
    limits,
    idempotency: new BoundedIdempotencyRegistry(
      limits.idempotencyCapacity,
      limits.idempotencyTtlMs,
    ),
    authFailures: new Map(),
    notifications: [],
    eventConnections: new Set(),
    sequence: 0,
    activeRequests: 0,
    stopRequested: false,
    securityFinding: undefined,
    securityFindingExpiresAt: undefined,
  };
  const stop = (): Promise<void> => {
    stopped ??= (async (): Promise<void> => {
      try {
        state.stopRequested = true;
        for (const connection of [...state.eventConnections])
          closeEventConnection(state, connection);
        if (server?.listening === true) await closeServer(server);
        await removeControlFiles(root);
        await releaseLock();
      } finally {
        resolveClosed?.();
      }
    })();
    return stopped;
  };
  try {
    const token = await createSecureToken(paths.tokenFilePath);
    state.tokenHash = createHash("sha256").update(token, "utf8").digest();
    server = createServer(
      { maxHeaderSize: limits.maxHeaderBytes, requireHostHeader: true },
      createRequestHandler(
        state,
        () => {
          if (descriptorValue === undefined) throw new Error("descriptor unavailable");
          return descriptorValue;
        },
        () => {
          void stop();
        },
      ),
    );
    server.headersTimeout = limits.requestTimeoutMs;
    server.requestTimeout = limits.requestTimeoutMs;
    server.keepAliveTimeout = Math.min(5_000, limits.requestTimeoutMs);
    const port = await listen(server);
    const tokenFileRef = relative(root, paths.tokenFilePath).split(sep).join("/");
    const boundDescriptor: ControlEndpointDescriptor = Object.freeze({
      schemaVersion: "1.0.0",
      instanceId,
      pid: process.pid,
      startedAt,
      host: "127.0.0.1",
      port,
      apiVersions: ["v1"] as const,
      frameworkVersion: options.frameworkVersion,
      releaseId: options.releaseId,
      tokenFileRef,
    });
    descriptorValue = boundDescriptor;
    await writeDescriptor(paths.descriptorPath, boundDescriptor);
  } catch (error) {
    if (server?.listening === true) await closeServer(server);
    await removeControlFiles(root);
    await releaseLock();
    throw error;
  }
  const descriptor: ControlEndpointDescriptor = descriptorValue;
  const publishNotification = (input: PublishNotificationInput): ControlNotification => {
    if (state.stopRequested)
      throw new ControlApiError("CONTROL_RUNTIME_STOPPED", "Runtime is stopped");
    const candidate: unknown = input;
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("projectionVersion" in candidate) ||
      !Number.isSafeInteger(candidate.projectionVersion) ||
      Number(candidate.projectionVersion) < 0 ||
      !("subjectRef" in candidate) ||
      !validSubjectRef(candidate.subjectRef) ||
      !("kind" in candidate) ||
      typeof candidate.kind !== "string" ||
      !["RUNTIME_STATUS", "OPERATION_METADATA", "EVIDENCE_METADATA"].includes(candidate.kind) ||
      !("resourceUri" in candidate) ||
      typeof candidate.resourceUri !== "string" ||
      !candidate.resourceUri.startsWith("/v1/") ||
      candidate.resourceUri.length > 1_024
    ) {
      throw new ControlApiError(
        "CONTROL_NOTIFICATION_INVALID",
        "Notification metadata failed validation",
      );
    }
    state.sequence += 1;
    const notification: ControlNotification = Object.freeze({
      schemaVersion: "1.0.0",
      notificationId: createUuidV7(),
      kind: candidate.kind as ControlNotification["kind"],
      subjectRef: Object.freeze({ ...candidate.subjectRef }),
      projectionVersion: candidate.projectionVersion as number,
      occurredAt: new Date().toISOString(),
      resourceUri: candidate.resourceUri,
    });
    state.notifications.push(notification);
    while (state.notifications.length > limits.sseRetentionCapacity) state.notifications.shift();
    for (const connection of [...state.eventConnections]) {
      if (!writeSse(connection, notification, limits.sseMaxBufferedBytes))
        closeEventConnection(state, connection);
    }
    return notification;
  };
  publishNotification({
    kind: "RUNTIME_STATUS",
    subjectRef: Object.freeze({ subjectType: "Runtime", subjectId: instanceId }),
    projectionVersion: 0,
    resourceUri: "/v1/status",
  });
  return Object.freeze({
    descriptor,
    descriptorPath: paths.descriptorPath,
    tokenFilePath: paths.tokenFilePath,
    closed,
    publishNotification,
    stop,
  });
}

export const startControlApiServer: typeof startControlApi = startControlApi;
