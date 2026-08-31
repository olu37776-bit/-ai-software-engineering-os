export type IsolationLevel = "PROCESS_RESTRICTED";

export interface WindowsProcessRestrictedLimits {
  readonly maxCpuTimeMs: number;
  readonly maxMemoryBytes: number;
  readonly maxProcessCount: number;
  readonly maxWallClockMs: number;
  readonly maxStdoutBytes: number;
  readonly maxStderrBytes: number;
}

export interface StagedInput {
  readonly relativePath: string;
  readonly content: Uint8Array | string;
}

export interface WindowsProcessRestrictedRequest {
  readonly toolRef: string;
  readonly argv: readonly string[];
  readonly stagingRoot: string;
  readonly inputs?: readonly StagedInput[];
  readonly environment?: Readonly<Record<string, string>>;
  readonly environmentAllowlist?: readonly string[];
  readonly limits: WindowsProcessRestrictedLimits;
  readonly evidenceContext: {
    readonly requirementId: string;
    readonly taskId: string;
    readonly executionId: string;
    readonly evidenceRefs: readonly SubjectRef[];
  };
  readonly signal?: AbortSignal;
}

export interface TrustedToolDescriptor {
  readonly toolRef: string;
  readonly toolVersion: string;
  readonly canonicalExecutablePath: string;
  readonly executableSha256: string;
}

export interface TrustedToolCatalog {
  resolve(toolRef: string): TrustedToolDescriptor | undefined;
}

export interface SubjectRef {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly subjectVersion?: string;
}

export interface IsolationCapabilityReport {
  readonly schemaVersion: "1.0.0";
  readonly reportId: string;
  readonly capabilityId: "windows-process-restricted";
  readonly capabilityVersion: "1.0.0";
  readonly providerId: "aseos.windows-job-object";
  readonly providerVersion: "1.0.0";
  readonly platform: "win32" | "linux" | "darwin";
  readonly isolationLevel: "PROCESS_RESTRICTED";
  readonly probe: {
    readonly probeId: string;
    readonly performedAt: string;
    readonly windowsBuild?: string;
    readonly jobObjectAvailable: boolean;
    readonly nestedProcessAssignmentSupported: boolean;
  };
  readonly budgetSupport: {
    readonly cpuTime: boolean;
    readonly memory: boolean;
    readonly processCount: boolean;
    readonly wallClock: boolean;
    readonly stdout: boolean;
    readonly stderr: boolean;
  };
  readonly guarantees: {
    readonly processTreeLifecycleContained: boolean;
    readonly resourceBudgetsEnforced: boolean;
    readonly networkAccessDenied: false;
    readonly filesystemAccessDenied: false;
    readonly registryAccessDenied: false;
    readonly securitySandbox: false;
  };
  readonly result: "AVAILABLE" | "UNAVAILABLE" | "PROBE_FAILED";
  readonly reasonCodes: readonly string[];
  readonly reportedAt: string;
}

export interface IsolationEvidence {
  readonly schemaVersion: "1.0.0";
  readonly evidenceId: string;
  readonly requirementId: string;
  readonly capabilityReportId: string;
  readonly taskId: string;
  readonly executionId: string;
  readonly providerId: "aseos.windows-job-object";
  readonly providerVersion: "1.0.0";
  readonly probeId: string;
  readonly selectedIsolationLevel: "PROCESS_RESTRICTED";
  readonly downgradeOccurred: false;
  readonly budgets: WindowsProcessRestrictedLimits;
  readonly usage: {
    readonly cpuTimeMs: number;
    readonly memoryPeakBytes: number;
    readonly processPeakCount: number;
    readonly wallClockMs: number;
    readonly stdoutBytes: number;
    readonly stderrBytes: number;
  };
  readonly processTree: {
    readonly rootProcessId: number;
    readonly jobObjectAssigned: true;
    readonly killOnJobClose: true;
    readonly descendantTerminationVerified: boolean;
    readonly activeProcessCountAfterCompletion: 0;
  };
  readonly guarantees: IsolationCapabilityReport["guarantees"];
  readonly result: {
    readonly outcome: "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
    readonly exitCode?: number;
    readonly terminationReason:
      | "EXITED"
      | "FAILED_TO_START"
      | "CANCELLED"
      | "WALL_CLOCK_LIMIT"
      | "CPU_LIMIT"
      | "MEMORY_LIMIT"
      | "PROCESS_COUNT_LIMIT"
      | "OUTPUT_LIMIT";
    readonly processTreeTerminated: true;
    readonly reasonCodes: readonly string[];
  };
  readonly evidenceRefs: readonly SubjectRef[];
  readonly startedAt: string;
  readonly completedAt: string;
}

export type WindowsProcessRestrictedResult =
  | {
      readonly status: "COMPLETED";
      readonly isolationLevel: IsolationLevel;
      readonly exitCode: number;
      readonly stdout: Uint8Array;
      readonly stderr: Uint8Array;
      readonly durationMs: number;
      readonly stagedWorkingDirectory: string;
      readonly capability: IsolationCapabilityReport;
      readonly evidence: IsolationEvidence;
    }
  | {
      readonly status: "TERMINATED";
      readonly isolationLevel: IsolationLevel;
      readonly reason:
        | "WALL_CLOCK_LIMIT"
        | "CPU_LIMIT"
        | "MEMORY_LIMIT"
        | "PROCESS_COUNT_LIMIT"
        | "OUTPUT_LIMIT"
        | "CANCELLED";
      readonly stdout: Uint8Array;
      readonly stderr: Uint8Array;
      readonly durationMs: number;
      readonly stagedWorkingDirectory: string;
      readonly capability: IsolationCapabilityReport;
      readonly evidence: IsolationEvidence;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly isolationLevel: IsolationLevel;
      readonly capability: IsolationCapabilityReport;
    }
  | {
      readonly status: "FAILED_TO_START";
      readonly isolationLevel: IsolationLevel;
      readonly code: string;
      readonly message: string;
      readonly stagedWorkingDirectory?: string;
    };
