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
  if (status < 200 || status >= 300) {
    const code = isProblem(value) ? value.code : "CONTROL_CLIENT_HTTP_ERROR";
    throw new ControlApiError(
      code,
      isProblem(value) ? value.detail : `Control API returned HTTP ${String(status)}`,
    );
  }
  return value as T;
}

function isNotification(value: unknown): value is ControlNotification {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    item["schemaVersion"] === "1.0.0" &&
    typeof item["notificationId"] === "string" &&
    typeof item["subjectRef"] === "object" &&
    item["subjectRef"] !== null &&
    Number.isSafeInteger(item["projectionVersion"]) &&
    typeof item["kind"] === "string" &&
    typeof item["occurredAt"] === "string" &&
    typeof item["resourceUri"] === "string"
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
    throw new ControlApiError(
      isProblem(value) ? value.code : "CONTROL_CLIENT_HTTP_ERROR",
      isProblem(value) ? value.detail : "Control event stream was rejected",
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
        if (!isNotification(parsed))
          throw new ControlApiError(
            "CONTROL_CLIENT_EVENT_INVALID",
            "Control event failed validation",
          );
        yield parsed;
      }
      boundary = pending.indexOf("\n\n");
    }
  }
}

export async function createControlApiClient(
  options: ControlApiClientOptions,
): Promise<ControlApiClient> {
  const descriptor = await discoverControlEndpoint(options.dataRoot);
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
  const version = (): Promise<VersionResponse> => invoke(state, "GET", "/v1/version");
  const health = (): Promise<HealthResponse> => invoke(state, "GET", "/v1/health");
  const status = (): Promise<StatusResponse> => invoke(state, "GET", "/v1/status");
  const doctor = (): Promise<DoctorResponse> => invoke(state, "GET", "/v1/doctor");
  const stop = (input: StopRuntimeInput): Promise<ControlOperationRef> =>
    invoke(state, "POST", "/v1/runtime/stop", {
      "idempotency-key": input.idempotencyKey,
      "if-match": `"${descriptor.instanceId}"`,
    });
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
