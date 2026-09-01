import {
  probeWindowsProcessRestrictedCapability,
  runWindowsProcessRestricted,
} from "@aseos/windows-process-restricted";
import type { IsolationCapabilityReport } from "@aseos/windows-process-restricted";
import type { TrustedToolCatalog } from "@aseos/windows-process-restricted";

import type {
  IsolationResolution,
  RestrictedWorkerTaskRequest,
  RestrictedWorkerTaskResult,
} from "./types.js";

const supportedFeatures = new Set([
  "JOB_OBJECT_KILL_ON_CLOSE",
  "PROCESS_TREE_CONTAINMENT",
  "CPU_LIMIT",
  "MEMORY_LIMIT",
  "PROCESS_COUNT_LIMIT",
  "WALL_CLOCK_LIMIT",
  "OUTPUT_LIMIT",
  "ENVIRONMENT_ALLOWLIST",
  "EXPLICIT_EXECUTABLE_AND_ARGV",
  "STAGED_WORKING_DIRECTORY",
  "CLOSED_STDIN",
  "CONTROLLED_STANDARD_HANDLES",
  "NO_SECRET_INHERITANCE",
]);
const requirementKeys = [
  "budgets",
  "capabilityId",
  "downgradeAllowed",
  "minimumIsolationLevel",
  "requiredProviderFeatures",
  "requirementId",
  "schemaVersion",
];
const budgetKeys = [
  "maxCpuTimeMs",
  "maxMemoryBytes",
  "maxProcessCount",
  "maxStderrBytes",
  "maxStdoutBytes",
  "maxWallClockMs",
];
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return (
    isRecord(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function isSafeIntegerBetween(
  value: unknown,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): boolean {
  return (
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum
  );
}

function isCanonicalRequirement(request: unknown): boolean {
  if (!isRecord(request) || !isRecord(request["evidenceContext"])) return false;
  const requirement = request["isolationRequirement"];
  if (!isRecord(requirement) || !isRecord(requirement["budgets"])) return false;
  const budgets = requirement["budgets"];
  const features = requirement["requiredProviderFeatures"];
  return (
    exactKeys(requirement, requirementKeys) &&
    exactKeys(budgets, budgetKeys) &&
    requirement["schemaVersion"] === "1.0.0" &&
    typeof requirement["requirementId"] === "string" &&
    uuidV7Pattern.test(requirement["requirementId"]) &&
    requirement["requirementId"] === request["evidenceContext"]["requirementId"] &&
    requirement["capabilityId"] === "windows-process-restricted" &&
    typeof requirement["minimumIsolationLevel"] === "string" &&
    ["PROCESS_RESTRICTED", "OS_SANDBOXED", "CONTAINER_ISOLATED", "REMOTE_ISOLATED"].includes(
      requirement["minimumIsolationLevel"],
    ) &&
    Array.isArray(features) &&
    features.length > 0 &&
    features.every((feature): feature is string => typeof feature === "string") &&
    new Set(features).size === features.length &&
    features.every((feature) => supportedFeatures.has(feature)) &&
    requirement["downgradeAllowed"] === false &&
    isSafeIntegerBetween(budgets["maxCpuTimeMs"], 1) &&
    isSafeIntegerBetween(budgets["maxMemoryBytes"], 1_048_576) &&
    isSafeIntegerBetween(budgets["maxProcessCount"], 1, 256) &&
    isSafeIntegerBetween(budgets["maxWallClockMs"], 1, 86_400_000) &&
    isSafeIntegerBetween(budgets["maxStdoutBytes"], 0) &&
    isSafeIntegerBetween(budgets["maxStderrBytes"], 0)
  );
}

function requestedLevel(request: unknown): IsolationResolution["requested"] {
  if (!isRecord(request) || !isRecord(request["isolationRequirement"])) return "INVALID";
  const value = request["isolationRequirement"]["minimumIsolationLevel"];
  return typeof value === "string" &&
    ["PROCESS_RESTRICTED", "OS_SANDBOXED", "CONTAINER_ISOLATED", "REMOTE_ISOLATED"].includes(value)
    ? (value as IsolationResolution["requested"])
    : "INVALID";
}

export function resolveIsolationProvider(
  request: RestrictedWorkerTaskRequest,
  probe: IsolationCapabilityReport,
): IsolationResolution {
  const base = {
    requested: requestedLevel(request),
    providerId: probe.providerId,
    providerVersion: probe.providerVersion,
    probe,
  } as const;
  if (!isCanonicalRequirement(request)) {
    return {
      status: "BLOCKED",
      selected: null,
      reasonCode: "INVALID_ISOLATION_REQUIREMENT",
      ...base,
    };
  }
  if (request.isolationRequirement.minimumIsolationLevel !== "PROCESS_RESTRICTED") {
    return {
      status: "BLOCKED",
      selected: null,
      reasonCode: "MINIMUM_ISOLATION_LEVEL_UNAVAILABLE",
      ...base,
    };
  }
  if (probe.result !== "AVAILABLE") {
    return {
      status: "BLOCKED",
      selected: null,
      reasonCode: "PROCESS_RESTRICTED_PROVIDER_UNAVAILABLE",
      ...base,
    };
  }
  if (
    request.isolationRequirement.requiredProviderFeatures.some(
      (feature) => !supportedFeatures.has(feature),
    )
  ) {
    return {
      status: "BLOCKED",
      selected: null,
      reasonCode: "REQUIRED_PROVIDER_FEATURE_UNAVAILABLE",
      ...base,
    };
  }
  return {
    status: "SELECTED",
    selected: "PROCESS_RESTRICTED",
    ...base,
    requested: "PROCESS_RESTRICTED",
  };
}

export async function executeRestrictedWorkerTask(
  request: RestrictedWorkerTaskRequest,
  trustedCatalog: TrustedToolCatalog,
): Promise<RestrictedWorkerTaskResult> {
  const probe = await probeWindowsProcessRestrictedCapability();
  const isolation = resolveIsolationProvider(request, probe);
  if (isolation.status === "BLOCKED") {
    return { status: "BLOCKED", isolation };
  }
  const adapterRequest = {
    toolRef: request.toolRef,
    argv: request.argv,
    stagingRoot: request.stagingRoot,
    limits: request.isolationRequirement.budgets,
    evidenceContext: request.evidenceContext,
    ...(request.inputs === undefined ? {} : { inputs: request.inputs }),
    ...(request.environment === undefined ? {} : { environment: request.environment }),
    ...(request.environmentAllowlist === undefined
      ? {}
      : { environmentAllowlist: request.environmentAllowlist }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  };
  const execution = await runWindowsProcessRestricted(adapterRequest, trustedCatalog, probe);
  return { status: "EXECUTED", isolation, execution };
}

export type {
  IsolationRequirement,
  IsolationResolution,
  RequestedIsolationLevel,
  RestrictedWorkerTaskRequest,
  RestrictedWorkerTaskResult,
  RestrictedWorkerTrustedCatalog,
} from "./types.js";
