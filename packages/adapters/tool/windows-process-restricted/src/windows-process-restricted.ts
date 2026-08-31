import { constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  normalize,
  parse,
  relative,
  resolve,
} from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { release } from "node:os";
import { fileURLToPath } from "node:url";

import type {
  IsolationCapabilityReport,
  IsolationEvidence,
  StagedInput,
  TrustedToolCatalog,
  TrustedToolDescriptor,
  WindowsProcessRestrictedRequest,
  WindowsProcessRestrictedResult,
} from "./types.js";

const bridgePath = fileURLToPath(new URL("./win32-bridge.ps1", import.meta.url));
const powershellPath = join(
  process.env["SystemRoot"] ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const environmentNamePattern = /^[A-Za-z_][A-Za-z0-9_()]*$/;
const deniedExecutableNames = new Set([
  "bash.exe",
  "cmd.exe",
  "cscript.exe",
  "mshta.exe",
  "node.exe",
  "powershell.exe",
  "pwsh.exe",
  "python.exe",
  "python3.exe",
  "sh.exe",
  "wscript.exe",
  "wsl.exe",
]);
const deniedExecutableExtensions = new Set([".bat", ".cmd", ".js", ".ps1", ".vbs", ".wsf"]);
const bridgeEnvironment = Object.fromEntries(
  ["SystemRoot", "WINDIR", "TEMP", "TMP"].flatMap((name) => {
    const value = process.env[name];
    return value === undefined ? [] : [[name, value]];
  }),
);

interface BridgeRequest {
  readonly executable: string;
  readonly executableSha256: string;
  readonly arguments: readonly string[];
  readonly workingDirectory: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly cancellationPath: string;
  readonly limits: {
    readonly wallClockMs: number;
    readonly processCpuTimeMs: number;
    readonly memoryBytes: number;
    readonly activeProcessLimit: number;
    readonly stdoutBytes: number;
    readonly stderrBytes: number;
  };
}

interface BridgeResponse {
  readonly status: "COMPLETED" | "TERMINATED" | "FAILED_TO_START";
  readonly exitCode?: number;
  readonly reason?:
    | "WALL_CLOCK_LIMIT"
    | "CPU_LIMIT"
    | "MEMORY_LIMIT"
    | "PROCESS_COUNT_LIMIT"
    | "OUTPUT_LIMIT"
    | "CANCELLED";
  readonly stdoutBase64?: string;
  readonly stderrBase64?: string;
  readonly durationMs: number;
  readonly code?: string;
  readonly message?: string;
  readonly rootProcessId?: number;
  readonly cpuTimeMs?: number;
  readonly memoryPeakBytes?: number;
  readonly processPeakCount?: number;
  readonly activeProcessCountAfterCompletion?: number;
  readonly descendantTerminationVerified?: boolean;
}

interface ProbeResponse {
  readonly available: boolean;
  readonly nestedProcessAssignmentSupported: boolean;
  readonly windowsBuild: string;
  readonly reasonCode?: string;
}

function uuidV7(): string {
  const bytes = randomBytes(16);
  const timestamp = Date.now();
  bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff;
  bytes[5] = timestamp & 0xff;
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const value = bytes.toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function createTrustedToolCatalog(
  entries: readonly TrustedToolDescriptor[],
): TrustedToolCatalog {
  const byReference = new Map<string, Readonly<TrustedToolDescriptor>>();
  for (const entry of entries) {
    if (byReference.has(entry.toolRef)) {
      throw new Error(`duplicate trusted tool catalog entry: ${entry.toolRef}`);
    }
    byReference.set(entry.toolRef, Object.freeze({ ...entry }));
  }
  return Object.freeze({
    resolve(toolRef: string): TrustedToolDescriptor | undefined {
      return byReference.get(toolRef);
    },
  });
}

function capabilityReport(
  result: IsolationCapabilityReport["result"],
  reasonCodes: readonly string[],
  probe: Readonly<{ available: boolean; nested: boolean; windowsBuild?: string }>,
): IsolationCapabilityReport {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    reportId: uuidV7(),
    capabilityId: "windows-process-restricted",
    capabilityVersion: "1.0.0",
    providerId: "aseos.windows-job-object",
    providerVersion: "1.0.0",
    platform:
      process.platform === "win32" ? "win32" : process.platform === "darwin" ? "darwin" : "linux",
    isolationLevel: "PROCESS_RESTRICTED",
    probe: {
      probeId: uuidV7(),
      performedAt: now,
      ...(process.platform === "win32" ? { windowsBuild: probe.windowsBuild ?? release() } : {}),
      jobObjectAvailable: probe.available,
      nestedProcessAssignmentSupported: probe.nested,
    },
    budgetSupport: {
      cpuTime: result === "AVAILABLE",
      memory: result === "AVAILABLE",
      processCount: result === "AVAILABLE",
      wallClock: result === "AVAILABLE",
      stdout: result === "AVAILABLE",
      stderr: result === "AVAILABLE",
    },
    guarantees: {
      processTreeLifecycleContained: result === "AVAILABLE",
      resourceBudgetsEnforced: result === "AVAILABLE",
      networkAccessDenied: false,
      filesystemAccessDenied: false,
      registryAccessDenied: false,
      securitySandbox: false,
    },
    result,
    reasonCodes,
    reportedAt: now,
  };
}

export async function probeWindowsProcessRestrictedCapability(): Promise<IsolationCapabilityReport> {
  if (process.platform !== "win32") {
    return capabilityReport("UNAVAILABLE", ["UNSUPPORTED_PLATFORM"], {
      available: false,
      nested: false,
    });
  }
  try {
    await access(powershellPath, fsConstants.X_OK);
  } catch {
    return capabilityReport("UNAVAILABLE", ["POWERSHELL_UNAVAILABLE"], {
      available: false,
      nested: false,
    });
  }
  try {
    await access(bridgePath, fsConstants.R_OK);
  } catch {
    return capabilityReport("UNAVAILABLE", ["BRIDGE_UNAVAILABLE"], {
      available: false,
      nested: false,
    });
  }
  try {
    const probe = await invokeProbe();
    return capabilityReport(
      probe.available && probe.nestedProcessAssignmentSupported ? "AVAILABLE" : "PROBE_FAILED",
      probe.available && probe.nestedProcessAssignmentSupported
        ? []
        : [probe.reasonCode ?? "WIN32_JOB_OBJECT_PROBE_FAILED"],
      {
        available: probe.available,
        nested: probe.nestedProcessAssignmentSupported,
        windowsBuild: probe.windowsBuild,
      },
    );
  } catch {
    return capabilityReport("PROBE_FAILED", ["WIN32_JOB_OBJECT_PROBE_FAILED"], {
      available: false,
      nested: false,
    });
  }
}

function validateBoundedInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive safe integer`);
  }
}

async function assertCanonicalNoReparse(path: string, kind: "file" | "directory"): Promise<string> {
  const absolute = resolve(path);
  const parsed = parse(absolute);
  let cursor = parsed.root;
  for (const component of absolute.slice(parsed.root.length).split(/[\\/]+/)) {
    cursor = join(cursor, component);
    const stat = await lstat(cursor);
    if (stat.isSymbolicLink()) {
      throw new Error(`${kind} path contains a symbolic link or junction: ${cursor}`);
    }
  }
  const canonical = await realpath(absolute);
  if (normalize(canonical).toLowerCase() !== normalize(absolute).toLowerCase()) {
    throw new Error(`${kind} path is not canonical: ${path}`);
  }
  const stat = await lstat(canonical);
  if ((kind === "file" && !stat.isFile()) || (kind === "directory" && !stat.isDirectory())) {
    throw new Error(`${kind} path has the wrong filesystem type: ${path}`);
  }
  return canonical;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const canonicalTypeNamePattern = /^[A-Z][A-Za-z0-9]{1,127}$/;

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRequestShape(request: WindowsProcessRestrictedRequest): void {
  const keys = Object.keys(request);
  const allowedKeys = new Set([
    "argv",
    "environment",
    "environmentAllowlist",
    "evidenceContext",
    "inputs",
    "limits",
    "signal",
    "stagingRoot",
    "toolRef",
  ]);
  if (keys.some((key) => !allowedKeys.has(key))) {
    throw new Error("request contains an unknown or authority-injecting field");
  }
  if (
    typeof request.toolRef !== "string" ||
    typeof request.stagingRoot !== "string" ||
    !Array.isArray(request.argv) ||
    request.argv.some((value) => typeof value !== "string") ||
    !isRecordValue(request.limits) ||
    !hasExactKeys(request.limits, [
      "maxCpuTimeMs",
      "maxMemoryBytes",
      "maxProcessCount",
      "maxStderrBytes",
      "maxStdoutBytes",
      "maxWallClockMs",
    ]) ||
    !isRecordValue(request.evidenceContext) ||
    (request.environment !== undefined && !isRecordValue(request.environment)) ||
    (request.environmentAllowlist !== undefined &&
      (!Array.isArray(request.environmentAllowlist) ||
        request.environmentAllowlist.some((value) => typeof value !== "string"))) ||
    (request.inputs !== undefined &&
      (!Array.isArray(request.inputs) ||
        request.inputs.some(
          (input) =>
            !isRecordValue(input) ||
            !hasExactKeys(input, ["content", "relativePath"]) ||
            typeof input["relativePath"] !== "string" ||
            (typeof input["content"] !== "string" && !(input["content"] instanceof Uint8Array)),
        )))
  ) {
    throw new Error("request does not match the exact WindowsProcessRestrictedRequest shape");
  }
}

async function validateRequest(
  request: WindowsProcessRestrictedRequest,
  tool: TrustedToolDescriptor,
): Promise<void> {
  validateRequestShape(request);
  if (!isAbsolute(tool.canonicalExecutablePath) || tool.canonicalExecutablePath.includes("\0")) {
    throw new Error("executable must be an absolute path without NUL characters");
  }
  if (!isAbsolute(request.stagingRoot)) {
    throw new Error("stagingRoot must be absolute");
  }
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(request.toolRef)) {
    throw new Error("toolRef is not canonical");
  }
  if (
    tool.toolRef !== request.toolRef ||
    !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(tool.toolVersion) ||
    !/^[0-9a-f]{64}$/.test(tool.executableSha256)
  ) {
    throw new Error(
      "trusted catalog descriptor is malformed or does not bind the requested toolRef",
    );
  }
  const executableName = basename(tool.canonicalExecutablePath).toLowerCase();
  if (
    deniedExecutableNames.has(executableName) ||
    deniedExecutableExtensions.has(extname(executableName))
  ) {
    throw new Error(`shell or script interpreter executable is forbidden: ${executableName}`);
  }
  for (const argument of request.argv) {
    if (argument.includes("\0")) {
      throw new Error("argv must not contain NUL characters");
    }
  }
  for (const [name, value] of Object.entries(request.environment ?? {})) {
    if (!environmentNamePattern.test(name) || value.includes("\0")) {
      throw new Error(`invalid environment entry: ${name}`);
    }
  }
  validateBoundedInteger("maxCpuTimeMs", request.limits.maxCpuTimeMs);
  validateBoundedInteger("maxMemoryBytes", request.limits.maxMemoryBytes);
  validateBoundedInteger("maxProcessCount", request.limits.maxProcessCount);
  validateBoundedInteger("maxWallClockMs", request.limits.maxWallClockMs);
  if (!Number.isSafeInteger(request.limits.maxStdoutBytes) || request.limits.maxStdoutBytes < 0) {
    throw new Error("maxStdoutBytes must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(request.limits.maxStderrBytes) || request.limits.maxStderrBytes < 0) {
    throw new Error("maxStderrBytes must be a non-negative safe integer");
  }
  if (request.limits.maxMemoryBytes < 1_048_576) {
    throw new Error("maxMemoryBytes must be at least 1 MiB");
  }
  if (request.limits.maxProcessCount > 256) {
    throw new Error("maxProcessCount must not exceed 256");
  }
  if (request.limits.maxWallClockMs > 86_400_000) {
    throw new Error("maxWallClockMs must not exceed 86400000");
  }
  const context = request.evidenceContext;
  const canonicalEvidenceRefs = context.evidenceRefs.map(
    (ref) => `${ref.subjectType}\u0000${ref.subjectId}\u0000${ref.subjectVersion ?? ""}`,
  );
  if (
    !hasExactKeys(context, ["evidenceRefs", "executionId", "requirementId", "taskId"]) ||
    !uuidV7Pattern.test(context.requirementId) ||
    !uuidV7Pattern.test(context.taskId) ||
    !uuidV7Pattern.test(context.executionId) ||
    context.evidenceRefs.length === 0 ||
    new Set(canonicalEvidenceRefs).size !== canonicalEvidenceRefs.length ||
    context.evidenceRefs.some(
      (ref) =>
        !hasExactKeys(
          ref,
          ref.subjectVersion === undefined
            ? ["subjectId", "subjectType"]
            : ["subjectId", "subjectType", "subjectVersion"],
        ) ||
        !canonicalTypeNamePattern.test(ref.subjectType) ||
        ref.subjectId.length < 1 ||
        ref.subjectId.length > 256 ||
        (ref.subjectVersion !== undefined &&
          (ref.subjectVersion.length < 1 || ref.subjectVersion.length > 128)),
    )
  ) {
    throw new Error("evidenceContext does not satisfy canonical IsolationEvidence identifiers");
  }
  await mkdir(request.stagingRoot, { recursive: true });
  const canonicalExecutable = await assertCanonicalNoReparse(tool.canonicalExecutablePath, "file");
  const actualDigest = await sha256File(canonicalExecutable);
  if (actualDigest !== tool.executableSha256) {
    throw new Error("trusted executable SHA-256 mismatch");
  }
  await assertCanonicalNoReparse(request.stagingRoot, "directory");
}

function selectEnvironment(
  request: WindowsProcessRestrictedRequest,
): Readonly<Record<string, string>> {
  const source = request.environment ?? {};
  const allowlist = new Set(request.environmentAllowlist ?? []);
  const selected: Record<string, string> = {};
  for (const name of allowlist) {
    if (!environmentNamePattern.test(name)) {
      throw new Error(`invalid environment allowlist entry: ${name}`);
    }
    const value = source[name];
    if (value !== undefined) {
      selected[name] = value;
    }
  }
  return selected;
}

function safeInputPath(stagingDirectory: string, input: StagedInput): string {
  const candidate = normalize(input.relativePath.replaceAll("/", "\\"));
  if (
    candidate.length === 0 ||
    candidate === "." ||
    isAbsolute(candidate) ||
    candidate.startsWith(`..\\`) ||
    candidate === ".." ||
    candidate.includes("\0")
  ) {
    throw new Error(`unsafe staged input path: ${input.relativePath}`);
  }
  const destination = resolve(stagingDirectory, candidate);
  const boundary = relative(stagingDirectory, destination);
  if (boundary.startsWith("..") || isAbsolute(boundary)) {
    throw new Error(`staged input escapes working directory: ${input.relativePath}`);
  }
  return destination;
}

async function createStagingDirectory(request: WindowsProcessRestrictedRequest): Promise<string> {
  await mkdir(request.stagingRoot, { recursive: true });
  const stagingDirectory = await mkdtemp(join(request.stagingRoot, "aseos-process-"));
  for (const input of request.inputs ?? []) {
    const destination = safeInputPath(stagingDirectory, input);
    await mkdir(resolve(destination, ".."), { recursive: true });
    await writeFile(destination, input.content, { flag: "wx" });
  }
  return stagingDirectory;
}

function decodeOutput(value: string | undefined): Uint8Array {
  return Buffer.from(value ?? "", "base64");
}

async function invokeProbe(): Promise<ProbeResponse> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(
      powershellPath,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        bridgePath,
        "-Probe",
      ],
      {
        env: bridgeEnvironment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 65_536) {
        child.kill();
        reject(new Error("Win32 capability probe response exceeded its bounded envelope"));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8").slice(0, 4096)));
        return;
      }
      resolvePromise(JSON.parse(Buffer.concat(stdout).toString("utf8")) as ProbeResponse);
    });
  });
}

async function invokeBridge(
  requestPath: string,
  cancellationPath: string,
  maximumResponseBytes: number,
  signal: AbortSignal | undefined,
): Promise<{ readonly cancelled: boolean; readonly stdout: string; readonly stderr: string }> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(
      powershellPath,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        bridgePath,
        "-RequestPath",
        requestPath,
      ],
      {
        env: bridgeEnvironment,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let cancelled = signal?.aborted ?? false;
    const onAbort = (): void => {
      cancelled = true;
      void writeFile(cancellationPath, "cancel\n", { flag: "wx" }).catch(() => child.kill());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maximumResponseBytes) {
        child.kill();
        reject(new Error("Win32 bridge response exceeded its bounded envelope"));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      signal?.removeEventListener("abort", onAbort);
      if (!cancelled && code !== 0) {
        reject(
          new Error(
            `Win32 bridge exited ${String(code)}: ${Buffer.concat(stderr).toString("utf8").slice(0, 4096)}`,
          ),
        );
        return;
      }
      resolvePromise({
        cancelled,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

function createEvidence(
  request: WindowsProcessRestrictedRequest,
  capability: IsolationCapabilityReport,
  response: BridgeResponse,
  stdout: Uint8Array,
  stderr: Uint8Array,
  startedAt: string,
): IsolationEvidence {
  const rootProcessId = response.rootProcessId;
  if (
    rootProcessId === undefined ||
    rootProcessId < 1 ||
    response.activeProcessCountAfterCompletion !== 0
  ) {
    throw new Error("Win32 bridge did not return a closed, attributable process tree");
  }
  const completedAt = new Date().toISOString();
  const terminationReason =
    response.status === "COMPLETED"
      ? "EXITED"
      : response.reason === "WALL_CLOCK_LIMIT"
        ? "WALL_CLOCK_LIMIT"
        : response.reason === "CPU_LIMIT"
          ? "CPU_LIMIT"
          : response.reason === "MEMORY_LIMIT"
            ? "MEMORY_LIMIT"
            : response.reason === "PROCESS_COUNT_LIMIT"
              ? "PROCESS_COUNT_LIMIT"
              : response.reason === "CANCELLED"
                ? "CANCELLED"
                : "OUTPUT_LIMIT";
  const succeeded = response.status === "COMPLETED" && response.exitCode === 0;
  return {
    schemaVersion: "1.0.0",
    evidenceId: uuidV7(),
    requirementId: request.evidenceContext.requirementId,
    capabilityReportId: capability.reportId,
    taskId: request.evidenceContext.taskId,
    executionId: request.evidenceContext.executionId,
    providerId: capability.providerId,
    providerVersion: capability.providerVersion,
    probeId: capability.probe.probeId,
    selectedIsolationLevel: "PROCESS_RESTRICTED",
    downgradeOccurred: false,
    budgets: request.limits,
    usage: {
      cpuTimeMs: response.cpuTimeMs ?? 0,
      memoryPeakBytes: response.memoryPeakBytes ?? 0,
      processPeakCount: response.processPeakCount ?? 1,
      wallClockMs: response.durationMs,
      stdoutBytes: stdout.byteLength,
      stderrBytes: stderr.byteLength,
    },
    processTree: {
      rootProcessId,
      jobObjectAssigned: true,
      killOnJobClose: true,
      descendantTerminationVerified: response.descendantTerminationVerified ?? false,
      activeProcessCountAfterCompletion: 0,
    },
    guarantees: capability.guarantees,
    result: {
      outcome: succeeded
        ? "SUCCEEDED"
        : terminationReason === "CANCELLED"
          ? "CANCELLED"
          : terminationReason === "WALL_CLOCK_LIMIT"
            ? "TIMED_OUT"
            : "FAILED",
      ...(response.exitCode === undefined ? {} : { exitCode: response.exitCode }),
      terminationReason,
      processTreeTerminated: true,
      reasonCodes: succeeded ? [] : [`PROCESS_${terminationReason}`],
    },
    evidenceRefs: request.evidenceContext.evidenceRefs,
    startedAt,
    completedAt,
  };
}

export async function runWindowsProcessRestricted(
  request: WindowsProcessRestrictedRequest,
  trustedCatalog: TrustedToolCatalog,
  probedCapability?: IsolationCapabilityReport,
): Promise<WindowsProcessRestrictedResult> {
  const runtimeRequest: unknown = request;
  if (!isRecordValue(runtimeRequest)) {
    return {
      status: "FAILED_TO_START",
      isolationLevel: "PROCESS_RESTRICTED",
      code: "INVALID_REQUEST",
      message: "The process request must be an object",
    };
  }
  const runtimeSignal = runtimeRequest["signal"];
  if (isRecordValue(runtimeSignal) && runtimeSignal["aborted"] === true) {
    return {
      status: "FAILED_TO_START",
      isolationLevel: "PROCESS_RESTRICTED",
      code: "REQUEST_CANCELLED_BEFORE_START",
      message: "The request was cancelled before a process was assigned to a Job Object",
    };
  }
  const capability = probedCapability ?? (await probeWindowsProcessRestrictedCapability());
  if (capability.result !== "AVAILABLE") {
    return { status: "UNAVAILABLE", isolationLevel: "PROCESS_RESTRICTED", capability };
  }
  if (typeof runtimeRequest["toolRef"] !== "string") {
    return {
      status: "FAILED_TO_START",
      isolationLevel: "PROCESS_RESTRICTED",
      code: "INVALID_REQUEST",
      message: "The process request must contain a canonical toolRef",
    };
  }
  const tool = trustedCatalog.resolve(request.toolRef);
  if (tool === undefined) {
    return {
      status: "FAILED_TO_START",
      isolationLevel: "PROCESS_RESTRICTED",
      code: "TRUSTED_TOOL_NOT_FOUND",
      message: `No trusted catalog entry exists for ${request.toolRef}`,
    };
  }
  const startedAt = new Date().toISOString();
  try {
    await validateRequest(request, tool);
    const stagingDirectory = await createStagingDirectory(request);
    const bridgeRequest: BridgeRequest = {
      executable: tool.canonicalExecutablePath,
      executableSha256: tool.executableSha256,
      arguments: [...request.argv],
      workingDirectory: stagingDirectory,
      environment: selectEnvironment(request),
      cancellationPath: join(stagingDirectory, ".aseos-cancel"),
      limits: {
        wallClockMs: request.limits.maxWallClockMs,
        processCpuTimeMs: request.limits.maxCpuTimeMs,
        memoryBytes: request.limits.maxMemoryBytes,
        activeProcessLimit: request.limits.maxProcessCount,
        stdoutBytes: request.limits.maxStdoutBytes,
        stderrBytes: request.limits.maxStderrBytes,
      },
    };
    const requestPath = join(stagingDirectory, ".aseos-request.json");
    await writeFile(requestPath, `${JSON.stringify(bridgeRequest)}\n`, { flag: "wx", mode: 0o600 });
    const maximumResponseBytes =
      Math.ceil(((request.limits.maxStdoutBytes + request.limits.maxStderrBytes) * 4) / 3) +
      1_048_576;
    const bridge = await invokeBridge(
      requestPath,
      bridgeRequest.cancellationPath,
      maximumResponseBytes,
      request.signal,
    );
    if (bridge.cancelled && bridge.stdout.length === 0) {
      return {
        status: "FAILED_TO_START",
        isolationLevel: "PROCESS_RESTRICTED",
        code: "CANCELLATION_BRIDGE_LOST",
        message: "The cancellation marker could not be observed before the bridge exited",
        stagedWorkingDirectory: stagingDirectory,
      };
    }
    const response = JSON.parse(bridge.stdout) as BridgeResponse;
    if (response.status === "FAILED_TO_START") {
      return {
        status: "FAILED_TO_START",
        isolationLevel: "PROCESS_RESTRICTED",
        code: response.code ?? "WIN32_BRIDGE_FAILURE",
        message: response.message ?? bridge.stderr,
        stagedWorkingDirectory: stagingDirectory,
      };
    }
    const output = {
      isolationLevel: "PROCESS_RESTRICTED" as const,
      durationMs: response.durationMs,
      stagedWorkingDirectory: stagingDirectory,
      capability,
    };
    const stdout = decodeOutput(response.stdoutBase64);
    const stderr = decodeOutput(response.stderrBase64);
    const evidence = createEvidence(request, capability, response, stdout, stderr, startedAt);
    if (response.status === "TERMINATED") {
      return {
        status: "TERMINATED",
        reason: response.reason ?? "WALL_CLOCK_LIMIT",
        ...output,
        stdout,
        stderr,
        evidence,
      };
    }
    return {
      status: "COMPLETED",
      exitCode: response.exitCode ?? -1,
      ...output,
      stdout,
      stderr,
      evidence,
    };
  } catch (error) {
    return {
      status: "FAILED_TO_START",
      isolationLevel: "PROCESS_RESTRICTED",
      code: "WINDOWS_PROCESS_RESTRICTED_FAILED",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
