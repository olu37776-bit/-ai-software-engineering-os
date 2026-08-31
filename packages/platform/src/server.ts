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

function validSubjectRef(value: PublishNotificationInput["subjectRef"]): boolean {
  const keys = Object.keys(value);
  return (
    (keys.length === 2 || (keys.length === 3 && typeof value.subjectVersion === "string")) &&
    /^[A-Z][A-Za-z0-9]{0,127}$/u.test(value.subjectType) &&
    value.subjectId.length >= 1 &&
    value.subjectId.length <= 256 &&
    (value.subjectVersion === undefined ||
      (value.subjectVersion.length >= 1 && value.subjectVersion.length <= 128))
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
    "authorization,content-type,idempotency-key,x-request-id,x-correlation-id,last-event-id",
  );
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("vary", "Origin");
}

function sendJson(
  response: ServerResponse,
  status: number,
  value: unknown,
  maxBytes: number,
  contentType = "application/json",
): void {
  let content = JSON.stringify(value);
  if (Buffer.byteLength(content) > maxBytes) {
    status = 500;
    content = JSON.stringify({
      type: "https://aseos.local/problems/response-limit-exceeded",
      title: "Response limit exceeded",
      status,
      detail: "The response exceeded its configured public boundary.",
      code: "CONTROL_RESPONSE_LIMIT_EXCEEDED",
    });
    contentType = "application/problem+json";
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

function writeSse(
  connection: EventConnection,
  notification: ControlNotification,
  maxBuffered: number,
): boolean {
  const data = `id: ${notification.notificationId}\nevent: ${notification.kind}\ndata: ${JSON.stringify(notification)}\n\n`;
  const bytes = Buffer.byteLength(data);
  connection.bufferedBytes += bytes;
  if (connection.bufferedBytes > maxBuffered) return false;
  const writable = connection.response.write(data, () => {
    connection.bufferedBytes = Math.max(0, connection.bufferedBytes - bytes);
  });
  return writable || connection.bufferedBytes <= maxBuffered;
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
    if (!response.write(": heartbeat\n\n")) closeEventConnection(state, connection);
  }, state.limits.sseHeartbeatMs);
  connection.heartbeat.unref();
  state.eventConnections.add(connection);
  const lastId = request.headers["last-event-id"];
  if (typeof lastId === "string" && state.notifications.length > 0) {
    const index = state.notifications.findIndex((item) => item.notificationId === lastId);
    if (index < 0) response.write('event: gap\ndata: {"code":"CONTROL_SSE_RETENTION_GAP"}\n\n');
    else
      for (const notification of state.notifications.slice(index + 1))
        writeSse(connection, notification, state.limits.sseMaxBufferedBytes);
  }
  request.once("close", () => {
    closeEventConnection(state, connection);
  });
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
        if (!tokenMatches(request.headers.authorization, state.tokenHash)) {
          const failure = registerAuthFailure(state, request.socket.remoteAddress ?? "unknown");
          if (failure.limited) response.setHeader("retry-after", failure.retryAfter);
          const status = failure.limited ? 429 : 401;
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
        if (request.method === "OPTIONS") {
          response.statusCode = 204;
          response.end();
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
          sendJson(
            response,
            200,
            {
              schemaVersion: "1.0.0",
              instanceId: current.instanceId,
              readiness: "READY",
              runtimeVersion: current.frameworkVersion,
              releaseId: current.releaseId,
              stateVersion: 0,
              checkedAt: new Date().toISOString(),
              findings: [],
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
          const findings: readonly DiagnosticFinding[] = [];
          sendJson(
            response,
            200,
            { schemaVersion: "1.0.0", status: "PASS", findings, ...ids },
            state.limits.maxResponseBytes,
          );
        } else if (request.method === "GET" && url.pathname === "/v1/events") {
          serveEvents(request, response, state, ids);
        } else if (request.method === "POST" && url.pathname === "/v1/runtime/stop") {
          const key = request.headers["idempotency-key"];
          if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/u.test(key)) {
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
    if (
      !Number.isSafeInteger(input.projectionVersion) ||
      input.projectionVersion < 0 ||
      !validSubjectRef(input.subjectRef) ||
      !input.resourceUri.startsWith("/v1/") ||
      input.resourceUri.length > 1_024
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
      kind: input.kind,
      subjectRef: input.subjectRef,
      projectionVersion: input.projectionVersion,
      occurredAt: new Date().toISOString(),
      resourceUri: input.resourceUri,
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
