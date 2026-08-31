import type { SubjectRef } from "@aseos/contracts";

export const CONTROL_API_VERSION = "v1";
export const CONTROL_ENDPOINT_SCHEMA_VERSION = "1.0.0";

export interface ControlEndpointDescriptor {
  readonly schemaVersion: "1.0.0";
  readonly instanceId: string;
  readonly pid: number;
  readonly startedAt: string;
  readonly host: "127.0.0.1";
  readonly port: number;
  readonly apiVersions: readonly string[];
  readonly frameworkVersion: string;
  readonly releaseId: string;
  readonly tokenFileRef: string;
}

export interface RequestIdentity {
  readonly requestId: string;
  readonly correlationId: string;
}

export interface VersionResponse extends RequestIdentity {
  readonly schemaVersion: "1.0.0";
  readonly apiVersion: "v1";
  readonly frameworkVersion: string;
  readonly releaseId: string;
  readonly instanceId: string;
}

export interface DiagnosticFinding {
  readonly schemaVersion: "1.0.0";
  readonly findingId: string;
  readonly code: string;
  readonly severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  readonly subjectRef: SubjectRef;
  readonly evidenceRefs: readonly SubjectRef[];
  readonly remediation: string;
  readonly detectedAt: string;
}

export interface HealthResponse {
  readonly schemaVersion: "1.0.0";
  readonly instanceId: string;
  readonly readiness: "READY" | "DEGRADED" | "NOT_READY";
  readonly runtimeVersion: string;
  readonly releaseId: string;
  readonly stateVersion: number;
  readonly checkedAt: string;
  readonly findings: readonly DiagnosticFinding[];
}

export interface BoundedControlMetadata {
  readonly authenticationRateLimit: {
    readonly capacity: number;
    readonly windowMs: number;
  };
  readonly idempotency: {
    readonly capacity: number;
    readonly ttlMs: number;
    readonly entries: number;
  };
  readonly sse: {
    readonly connectionCapacity: number;
    readonly activeConnections: number;
    readonly retentionCapacity: number;
    readonly retainedNotifications: number;
    readonly heartbeatMs: number;
  };
}

export interface StatusResponse extends RequestIdentity {
  readonly schemaVersion: "1.0.0";
  readonly status: "READY";
  readonly instanceId: string;
  readonly uptimeMs: number;
  readonly limits: BoundedControlMetadata;
}

export interface DoctorResponse extends RequestIdentity {
  readonly schemaVersion: "1.0.0";
  readonly status: "PASS" | "FINDINGS";
  readonly findings: readonly DiagnosticFinding[];
}

export interface ProblemDetails extends RequestIdentity {
  readonly schemaVersion: "1.0.0";
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: string;
  readonly category: string;
  readonly retryability: "RETRYABLE" | "NON_RETRYABLE" | "CONDITIONAL" | "UNKNOWN";
  readonly subjectRef: SubjectRef;
  readonly remediation: string;
}

export interface ControlNotification {
  readonly schemaVersion: "1.0.0";
  readonly notificationId: string;
  readonly kind: "RUNTIME_STATUS" | "OPERATION_METADATA" | "EVIDENCE_METADATA";
  readonly subjectRef: SubjectRef;
  readonly projectionVersion: number;
  readonly occurredAt: string;
  readonly resourceUri: string;
}

export interface PublishNotificationInput {
  readonly kind: ControlNotification["kind"];
  readonly subjectRef: SubjectRef;
  readonly projectionVersion: number;
  readonly resourceUri: string;
}

export interface ControlOperationRef {
  readonly schemaVersion: "1.0.0";
  readonly operationId: string;
  readonly type: string;
  readonly status: string;
  readonly resourceUri: string;
  readonly resultUri?: string;
  readonly evidenceRefs: readonly SubjectRef[];
}

export interface StopRuntimeInput {
  readonly idempotencyKey: string;
}

export interface ControlApiLimits {
  readonly maxHeaderBytes: number;
  readonly maxUrlBytes: number;
  readonly maxBodyBytes: number;
  readonly maxResponseBytes: number;
  readonly maxConcurrentRequests: number;
  readonly requestTimeoutMs: number;
  readonly authFailureCapacity: number;
  readonly authFailureWindowMs: number;
  readonly idempotencyCapacity: number;
  readonly idempotencyTtlMs: number;
  readonly sseConnectionCapacity: number;
  readonly sseRetentionCapacity: number;
  readonly sseHeartbeatMs: number;
  readonly sseMaxBufferedBytes: number;
}

export interface StartControlApiOptions {
  readonly dataRoot: string;
  readonly frameworkVersion: string;
  readonly releaseId: string;
  readonly allowedOrigins?: readonly string[];
  readonly limits?: Partial<ControlApiLimits>;
}

export interface ControlApiRuntime {
  readonly descriptor: ControlEndpointDescriptor;
  readonly descriptorPath: string;
  readonly tokenFilePath: string;
  readonly closed: Promise<void>;
  publishNotification(input: PublishNotificationInput): ControlNotification;
  stop(): Promise<void>;
}

export interface ControlApiClientOptions {
  readonly dataRoot: string;
  readonly timeoutMs?: number;
  readonly maxResponseBytes?: number;
}

export interface ControlApiClient {
  readonly descriptor: ControlEndpointDescriptor;
  version(): Promise<VersionResponse>;
  health(): Promise<HealthResponse>;
  status(): Promise<StatusResponse>;
  doctor(): Promise<DoctorResponse>;
  stop(input: StopRuntimeInput): Promise<ControlOperationRef>;
  events(
    options?: Readonly<{ lastEventId?: string; signal?: AbortSignal }>,
  ): AsyncIterable<ControlEventStreamItem>;
}

export type ControlEventStreamItem =
  | ControlNotification
  | Readonly<{ readonly kind: "RETENTION_GAP"; readonly code: "CONTROL_SSE_RETENTION_GAP" }>;
