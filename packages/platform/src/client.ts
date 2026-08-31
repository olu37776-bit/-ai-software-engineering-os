import { request, type IncomingMessage, type RequestOptions } from "node:http";

import { ControlApiError } from "./errors.js";
import { discoverControlEndpoint, readControlToken } from "./filesystem.js";
import type {
  ControlApiClient,
  ControlApiClientOptions,
  ControlEndpointDescriptor,
  ControlEventStreamItem,
  ControlNotification,
  ControlOperationRef,
  DoctorResponse,
  HealthResponse,
  ProblemDetails,
  StatusResponse,
  StopRuntimeInput,
  VersionResponse,
} from "./types.js";

interface ClientState {
  readonly descriptor: ControlEndpointDescriptor;
  readonly token: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SEMANTIC_VERSION_PATTERN =
  /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validRequestIdentity(value: Record<string, unknown>): boolean {
  return (
    typeof value["requestId"] === "string" &&
    UUID_V7_PATTERN.test(value["requestId"]) &&
    typeof value["correlationId"] === "string" &&
    UUID_V7_PATTERN.test(value["correlationId"])
  );
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(item[key])}`)
    .join(",")}}`;
}

function uniqueValues(values: readonly unknown[]): boolean {
  return new Set(values.map(canonicalJson)).size === values.length;
}

function isRfc3339DateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/u.exec(
      value,
    );
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === undefined ? 0 : Number(match[8]);
  const offsetMinute = match[9] === undefined ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    daysInMonth !== undefined &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function responseMediaType(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.split(";", 1)[0]?.trim().toLowerCase();
}

function isVersionResponse(value: unknown): value is VersionResponse {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(item, [
      "schemaVersion",
      "apiVersion",
      "frameworkVersion",
      "releaseId",
      "instanceId",
      "requestId",
      "correlationId",
    ]) &&
    item["schemaVersion"] === "1.0.0" &&
    item["apiVersion"] === "v1" &&
    typeof item["frameworkVersion"] === "string" &&
    SEMANTIC_VERSION_PATTERN.test(item["frameworkVersion"]) &&
    typeof item["releaseId"] === "string" &&
    item["releaseId"].length >= 1 &&
    item["releaseId"].length <= 256 &&
    typeof item["instanceId"] === "string" &&
    UUID_V7_PATTERN.test(item["instanceId"]) &&
    validRequestIdentity(item)
  );
}

function nonNegativeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 1;
}

function isSubjectRef(value: unknown): boolean {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(
      item,
      item["subjectVersion"] === undefined
        ? ["subjectType", "subjectId"]
        : ["subjectType", "subjectId", "subjectVersion"],
    ) &&
    typeof item["subjectType"] === "string" &&
    /^[A-Z][A-Za-z0-9]{1,127}$/u.test(item["subjectType"]) &&
    typeof item["subjectId"] === "string" &&
    item["subjectId"].length >= 1 &&
    item["subjectId"].length <= 256 &&
    (item["subjectVersion"] === undefined ||
      (typeof item["subjectVersion"] === "string" &&
        item["subjectVersion"].length >= 1 &&
        item["subjectVersion"].length <= 128))
  );
}

function isDiagnosticFinding(value: unknown): boolean {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(item, [
      "schemaVersion",
      "findingId",
      "code",
      "severity",
      "subjectRef",
      "evidenceRefs",
      "remediation",
      "detectedAt",
    ]) &&
    item["schemaVersion"] === "1.0.0" &&
    typeof item["findingId"] === "string" &&
    UUID_V7_PATTERN.test(item["findingId"]) &&
    typeof item["code"] === "string" &&
    /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u.test(item["code"]) &&
    item["code"].length >= 3 &&
    item["code"].length <= 128 &&
    ["INFO", "WARNING", "ERROR", "CRITICAL"].includes(String(item["severity"])) &&
    isSubjectRef(item["subjectRef"]) &&
    Array.isArray(item["evidenceRefs"]) &&
    item["evidenceRefs"].every(isSubjectRef) &&
    uniqueValues(item["evidenceRefs"]) &&
    typeof item["remediation"] === "string" &&
    item["remediation"].length >= 1 &&
    item["remediation"].length <= 2048 &&
    isRfc3339DateTime(item["detectedAt"])
  );
}

function isHealthResponse(value: unknown): value is HealthResponse {
  const item = objectValue(value);
  if (
    item === undefined ||
    !exactKeys(item, [
      "schemaVersion",
      "instanceId",
      "readiness",
      "runtimeVersion",
      "releaseId",
      "stateVersion",
      "checkedAt",
      "findings",
    ]) ||
    item["schemaVersion"] !== "1.0.0" ||
    typeof item["instanceId"] !== "string" ||
    !UUID_V7_PATTERN.test(item["instanceId"]) ||
    !["READY", "DEGRADED", "NOT_READY"].includes(String(item["readiness"])) ||
    typeof item["runtimeVersion"] !== "string" ||
    !SEMANTIC_VERSION_PATTERN.test(item["runtimeVersion"]) ||
    typeof item["releaseId"] !== "string" ||
    item["releaseId"].length < 1 ||
    item["releaseId"].length > 256 ||
    !nonNegativeInteger(item["stateVersion"]) ||
    !isRfc3339DateTime(item["checkedAt"]) ||
    !Array.isArray(item["findings"]) ||
    !item["findings"].every(isDiagnosticFinding) ||
    !uniqueValues(item["findings"])
  ) {
    return false;
  }
  return item["readiness"] === "READY"
    ? item["findings"].length === 0
    : item["findings"].length > 0;
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(item, [
      "schemaVersion",
      "type",
      "title",
      "status",
      "detail",
      "code",
      "category",
      "retryability",
      "requestId",
      "correlationId",
      "subjectRef",
      "remediation",
    ]) &&
    item["schemaVersion"] === "1.0.0" &&
    typeof item["type"] === "string" &&
    URL.canParse(item["type"]) &&
    typeof item["title"] === "string" &&
    item["title"].length >= 1 &&
    item["title"].length <= 256 &&
    typeof item["status"] === "number" &&
    Number.isInteger(item["status"]) &&
    item["status"] >= 400 &&
    item["status"] <= 599 &&
    typeof item["detail"] === "string" &&
    item["detail"].length >= 1 &&
    item["detail"].length <= 2048 &&
    typeof item["code"] === "string" &&
    /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u.test(item["code"]) &&
    item["code"].length >= 3 &&
    item["code"].length <= 128 &&
    [
      "VALIDATION",
      "CONFLICT",
      "POLICY",
      "AUTHENTICATION",
      "AUTHORIZATION",
      "UNAVAILABLE",
      "TIMEOUT",
      "CANCELLED",
      "INFRASTRUCTURE",
      "INVARIANT",
      "SECURITY",
      "RECONCILIATION",
    ].includes(String(item["category"])) &&
    ["RETRYABLE", "NON_RETRYABLE", "CONDITIONAL", "UNKNOWN"].includes(
      String(item["retryability"]),
    ) &&
    validRequestIdentity(item) &&
    isSubjectRef(item["subjectRef"]) &&
    typeof item["remediation"] === "string" &&
    item["remediation"].length >= 1 &&
    item["remediation"].length <= 2048 &&
    item["type"].length <= 512
  );
}

function isOperationRef(value: unknown): value is ControlOperationRef {
  const item = objectValue(value);
  const expected = [
    "schemaVersion",
    "operationId",
    "type",
    "status",
    "resourceUri",
    "evidenceRefs",
    ...(item?.["resultUri"] === undefined ? [] : ["resultUri"]),
  ];
  return (
    item !== undefined &&
    exactKeys(item, expected) &&
    item["schemaVersion"] === "1.0.0" &&
    typeof item["operationId"] === "string" &&
    UUID_V7_PATTERN.test(item["operationId"]) &&
    typeof item["type"] === "string" &&
    /^[A-Z][A-Za-z0-9]{1,127}$/u.test(item["type"]) &&
    typeof item["status"] === "string" &&
    item["status"].length >= 3 &&
    item["status"].length <= 128 &&
    /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u.test(item["status"]) &&
    typeof item["resourceUri"] === "string" &&
    item["resourceUri"].startsWith("/v1/operations/") &&
    item["resourceUri"].length <= 1024 &&
    (item["resultUri"] === undefined ||
      (typeof item["resultUri"] === "string" &&
        item["resultUri"].startsWith("/v1/") &&
        item["resultUri"].length <= 1024)) &&
    Array.isArray(item["evidenceRefs"]) &&
    item["evidenceRefs"].every(isSubjectRef) &&
    uniqueValues(item["evidenceRefs"])
  );
}

function isStatusResponse(value: unknown): value is StatusResponse {
  const item = objectValue(value);
  const limits = objectValue(item?.["limits"]);
  const authentication = objectValue(limits?.["authenticationRateLimit"]);
  const idempotency = objectValue(limits?.["idempotency"]);
  const sse = objectValue(limits?.["sse"]);
  return (
    item !== undefined &&
    exactKeys(item, [
      "schemaVersion",
      "status",
      "instanceId",
      "uptimeMs",
      "limits",
      "requestId",
      "correlationId",
    ]) &&
    item["schemaVersion"] === "1.0.0" &&
    item["status"] === "READY" &&
    typeof item["instanceId"] === "string" &&
    UUID_V7_PATTERN.test(item["instanceId"]) &&
    nonNegativeInteger(item["uptimeMs"]) &&
    validRequestIdentity(item) &&
    limits !== undefined &&
    exactKeys(limits, ["authenticationRateLimit", "idempotency", "sse"]) &&
    authentication !== undefined &&
    exactKeys(authentication, ["capacity", "windowMs"]) &&
    positiveInteger(authentication["capacity"]) &&
    positiveInteger(authentication["windowMs"]) &&
    idempotency !== undefined &&
    exactKeys(idempotency, ["capacity", "ttlMs", "entries"]) &&
    positiveInteger(idempotency["capacity"]) &&
    positiveInteger(idempotency["ttlMs"]) &&
    nonNegativeInteger(idempotency["entries"]) &&
    sse !== undefined &&
    exactKeys(sse, [
      "connectionCapacity",
      "activeConnections",
      "retentionCapacity",
      "retainedNotifications",
      "heartbeatMs",
    ]) &&
    positiveInteger(sse["connectionCapacity"]) &&
    nonNegativeInteger(sse["activeConnections"]) &&
    positiveInteger(sse["retentionCapacity"]) &&
    nonNegativeInteger(sse["retainedNotifications"]) &&
    positiveInteger(sse["heartbeatMs"])
  );
}

function isDoctorResponse(value: unknown): value is DoctorResponse {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(item, ["schemaVersion", "status", "findings", "requestId", "correlationId"]) &&
    item["schemaVersion"] === "1.0.0" &&
    (item["status"] === "PASS" || item["status"] === "FINDINGS") &&
    validRequestIdentity(item) &&
    Array.isArray(item["findings"]) &&
    item["findings"].every(isDiagnosticFinding) &&
    uniqueValues(item["findings"]) &&
    ((item["status"] === "PASS" && item["findings"].length === 0) ||
      (item["status"] === "FINDINGS" && item["findings"].length > 0))
  );
}

function validateContract(schemaId: string, value: unknown): unknown {
  const valid =
    schemaId === "urn:aseos:schema:control-endpoint-descriptor:1.0.0"
      ? objectValue(value) !== undefined
      : schemaId === "urn:aseos:schema:control-api-problem:1.0.0"
        ? isProblemDetails(value)
        : schemaId === "urn:aseos:schema:runtime-health:1.0.0"
          ? isHealthResponse(value)
          : schemaId === "urn:aseos:schema:control-operation-ref:1.0.0"
            ? isOperationRef(value)
            : false;
  if (!valid) {
    throw new ControlApiError(
      "CONTROL_CLIENT_RESPONSE_INVALID",
      "Control API response failed its public Contract",
    );
  }
  return value;
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function requestOptions(
  state: ClientState,
  method: "GET" | "POST",
  path: string,
  extraHeaders: Readonly<Record<string, string>> = {},
): RequestOptions {
  return {
    host: "127.0.0.1",
    port: state.descriptor.port,
    method,
    path,
    agent: false,
    headers: {
      accept: "application/json, application/problem+json",
      authorization: `Bearer ${state.token}`,
      host: `127.0.0.1:${String(state.descriptor.port)}`,
      ...extraHeaders,
    },
  };
}

async function collectResponse(response: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of response) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > maxBytes) {
      response.destroy();
      throw new ControlApiError(
        "CONTROL_CLIENT_RESPONSE_TOO_LARGE",
        "Control API response exceeded the client limit",
      );
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    throw new ControlApiError(
      "CONTROL_CLIENT_RESPONSE_INVALID",
      "Control API returned invalid JSON",
      { cause: error },
    );
  }
}

function isProblem(value: unknown): value is ProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)["code"] === "string"
  );
}

async function invoke<T>(
  state: ClientState,
  method: "GET" | "POST",
  path: string,
  headers?: Readonly<Record<string, string>>,
  schemaId?: string,
  validateLocal?: (value: unknown) => value is T,
): Promise<T> {
  const response = await new Promise<IncomingMessage>((resolvePromise, reject) => {
    const outgoing = request(requestOptions(state, method, path, headers), resolvePromise);
    outgoing.setTimeout(state.timeoutMs, () => outgoing.destroy(new Error("request timeout")));
    outgoing.once("error", reject);
    outgoing.end();
  }).catch((error: unknown) => {
    throw new ControlApiError("CONTROL_CLIENT_UNAVAILABLE", "Control API request failed", {
      cause: error,
    });
  });
  const value = await collectResponse(response, state.maxResponseBytes);
  const status = response.statusCode ?? 0;
  const contentType = responseMediaType(response.headers["content-type"]);
  if (status < 200 || status >= 300) {
    const validatedProblem = validateContract(
      "urn:aseos:schema:control-api-problem:1.0.0",
      value,
    ) as ProblemDetails;
    if (contentType !== "application/problem+json" || validatedProblem.status !== status) {
      throw new ControlApiError(
        "CONTROL_CLIENT_RESPONSE_INVALID",
        "Control API problem response failed its HTTP binding",
      );
    }
    const code = isProblem(validatedProblem) ? validatedProblem.code : "CONTROL_CLIENT_HTTP_ERROR";
    throw new ControlApiError(
      code,
      isProblem(validatedProblem)
        ? validatedProblem.detail
        : `Control API returned HTTP ${String(status)}`,
    );
  }
  if (contentType !== "application/json") {
    throw new ControlApiError(
      "CONTROL_CLIENT_RESPONSE_INVALID",
      "Control API response used an unexpected content type",
    );
  }
  if (schemaId !== undefined) return validateContract(schemaId, value) as T;
  if (validateLocal?.(value) !== true) {
    throw new ControlApiError(
      "CONTROL_CLIENT_RESPONSE_INVALID",
      "Control API response failed its public Contract",
    );
  }
  return value;
}

function isNotification(value: unknown): value is ControlNotification {
  const item = objectValue(value);
  return (
    item !== undefined &&
    exactKeys(item, [
      "schemaVersion",
      "notificationId",
      "subjectRef",
      "projectionVersion",
      "kind",
      "occurredAt",
      "resourceUri",
    ]) &&
    item["schemaVersion"] === "1.0.0" &&
    typeof item["notificationId"] === "string" &&
    UUID_V7_PATTERN.test(item["notificationId"]) &&
    isSubjectRef(item["subjectRef"]) &&
    nonNegativeInteger(item["projectionVersion"]) &&
    ["RUNTIME_STATUS", "OPERATION_METADATA", "EVIDENCE_METADATA"].includes(String(item["kind"])) &&
    isRfc3339DateTime(item["occurredAt"]) &&
    typeof item["resourceUri"] === "string" &&
    item["resourceUri"].startsWith("/v1/") &&
    item["resourceUri"].length <= 1024
  );
}

async function* streamEvents(
  state: ClientState,
  options: Readonly<{ lastEventId?: string; signal?: AbortSignal }> | undefined,
): AsyncGenerator<ControlEventStreamItem, void, undefined> {
  const headers: Record<string, string> = { accept: "text/event-stream" };
  if (options?.lastEventId !== undefined) headers["last-event-id"] = options.lastEventId;
  const response = await new Promise<IncomingMessage>((resolvePromise, reject) => {
    const outgoing = request(requestOptions(state, "GET", "/v1/events", headers), resolvePromise);
    const abort = (): void => {
      outgoing.destroy(new Error("event stream aborted"));
    };
    options?.signal?.addEventListener("abort", abort, { once: true });
    outgoing.once("error", reject);
    outgoing.end();
  }).catch((error: unknown) => {
    throw new ControlApiError("CONTROL_CLIENT_UNAVAILABLE", "Control event stream failed", {
      cause: error,
    });
  });
  if (response.statusCode !== 200) {
    const value = await collectResponse(response, state.maxResponseBytes);
    const validatedProblem = validateContract(
      "urn:aseos:schema:control-api-problem:1.0.0",
      value,
    ) as ProblemDetails;
    if (
      responseMediaType(response.headers["content-type"]) !== "application/problem+json" ||
      validatedProblem.status !== response.statusCode
    ) {
      throw new ControlApiError(
        "CONTROL_CLIENT_RESPONSE_INVALID",
        "Control event error failed its HTTP binding",
      );
    }
    throw new ControlApiError(validatedProblem.code, validatedProblem.detail);
  }
  if (responseMediaType(response.headers["content-type"]) !== "text/event-stream") {
    response.destroy();
    throw new ControlApiError(
      "CONTROL_CLIENT_RESPONSE_INVALID",
      "Control event stream used an unexpected content type",
    );
  }
  let pending = "";
  for await (const chunk of response) {
    pending += Buffer.from(chunk as Uint8Array).toString("utf8");
    if (Buffer.byteLength(pending) > state.maxResponseBytes) {
      response.destroy();
      throw new ControlApiError(
        "CONTROL_CLIENT_RESPONSE_TOO_LARGE",
        "Control event frame exceeded the client limit",
      );
    }
    let boundary = pending.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const event = frame
        .split("\n")
        .find((line) => line.startsWith("event: "))
        ?.slice(7);
      const data = frame
        .split("\n")
        .find((line) => line.startsWith("data: "))
        ?.slice(6);
      if (event === "gap") {
        let gap: unknown;
        try {
          gap = data === undefined ? undefined : (JSON.parse(data) as unknown);
        } catch {
          gap = undefined;
        }
        const gapValue = objectValue(gap);
        if (
          gapValue === undefined ||
          !exactKeys(gapValue, ["code"]) ||
          gapValue["code"] !== "CONTROL_SSE_RETENTION_GAP"
        ) {
          throw new ControlApiError(
            "CONTROL_CLIENT_EVENT_INVALID",
            "Control event gap failed validation",
          );
        }
        yield Object.freeze({ kind: "RETENTION_GAP", code: "CONTROL_SSE_RETENTION_GAP" });
      } else if (data !== undefined) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data) as unknown;
        } catch {
          throw new ControlApiError(
            "CONTROL_CLIENT_EVENT_INVALID",
            "Control event contained invalid JSON",
          );
        }
        if (!isNotification(parsed) || event !== parsed.kind)
          throw new ControlApiError(
            "CONTROL_CLIENT_EVENT_INVALID",
            "Control event failed validation",
          );
        yield parsed;
      } else if (!frame.startsWith(":")) {
        throw new ControlApiError(
          "CONTROL_CLIENT_EVENT_INVALID",
          "Control event frame was incomplete",
        );
      }
      boundary = pending.indexOf("\n\n");
    }
  }
}

export async function createControlApiClient(
  options: ControlApiClientOptions,
): Promise<ControlApiClient> {
  const descriptor = await discoverControlEndpoint(options.dataRoot);
  if (!descriptor.apiVersions.includes("v1")) {
    throw new ControlApiError(
      "CONTROL_API_VERSION_UNSUPPORTED",
      "Endpoint descriptor does not advertise the supported Control API version",
    );
  }
  if (!processExists(descriptor.pid)) {
    throw new ControlApiError(
      "CONTROL_DESCRIPTOR_STALE",
      "Endpoint descriptor refers to a stopped process",
    );
  }
  const token = await readControlToken(options.dataRoot, descriptor);
  const state: ClientState = Object.freeze({
    descriptor,
    token,
    timeoutMs: options.timeoutMs ?? 5_000,
    maxResponseBytes: options.maxResponseBytes ?? 256 * 1024,
  });
  const version = (): Promise<VersionResponse> =>
    invoke(state, "GET", "/v1/version", undefined, undefined, isVersionResponse);
  const health = (): Promise<HealthResponse> =>
    invoke(state, "GET", "/v1/health", undefined, "urn:aseos:schema:runtime-health:1.0.0");
  const status = (): Promise<StatusResponse> =>
    invoke(state, "GET", "/v1/status", undefined, undefined, isStatusResponse);
  const doctor = (): Promise<DoctorResponse> =>
    invoke(state, "GET", "/v1/doctor", undefined, undefined, isDoctorResponse);
  const stop = (input: StopRuntimeInput): Promise<ControlOperationRef> =>
    invoke(
      state,
      "POST",
      "/v1/runtime/stop",
      {
        "idempotency-key": input.idempotencyKey,
        "if-match": `"${descriptor.instanceId}"`,
      },
      "urn:aseos:schema:control-operation-ref:1.0.0",
    );
  const events = (
    eventOptions?: Readonly<{ lastEventId?: string; signal?: AbortSignal }>,
  ): AsyncIterable<ControlEventStreamItem> => streamEvents(state, eventOptions);
  const firstHealth = await health();
  if (
    firstHealth.instanceId !== descriptor.instanceId ||
    firstHealth.runtimeVersion !== descriptor.frameworkVersion ||
    firstHealth.releaseId !== descriptor.releaseId
  ) {
    throw new ControlApiError(
      "CONTROL_ENDPOINT_IDENTITY_MISMATCH",
      "Authenticated endpoint identity does not match its descriptor",
    );
  }
  return Object.freeze({ descriptor, version, health, status, doctor, stop, events });
}
