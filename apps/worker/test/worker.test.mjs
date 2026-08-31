import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createTrustedToolCatalog } from "@aseos/windows-process-restricted";

import { executeRestrictedWorkerTask, resolveIsolationProvider } from "../dist/index.js";

const id = "019a0597-c903-7a4f-8842-efb9791bf690";
const availableProbe = {
  schemaVersion: "1.0.0",
  reportId: id,
  capabilityId: "windows-process-restricted",
  capabilityVersion: "1.0.0",
  providerId: "aseos.windows-job-object",
  providerVersion: "1.0.0",
  platform: "win32",
  isolationLevel: "PROCESS_RESTRICTED",
  probe: {
    probeId: id,
    performedAt: new Date().toISOString(),
    windowsBuild: "10.0.26200",
    jobObjectAvailable: true,
    nestedProcessAssignmentSupported: true,
  },
  budgetSupport: {
    cpuTime: true,
    memory: true,
    processCount: true,
    wallClock: true,
    stdout: true,
    stderr: true,
  },
  guarantees: {
    processTreeLifecycleContained: true,
    resourceBudgetsEnforced: true,
    networkAccessDenied: false,
    filesystemAccessDenied: false,
    registryAccessDenied: false,
    securitySandbox: false,
  },
  result: "AVAILABLE",
  reasonCodes: [],
  reportedAt: new Date().toISOString(),
};

function canonicalResolutionRequest(minimumIsolationLevel = "PROCESS_RESTRICTED") {
  return {
    evidenceContext: { requirementId: id },
    isolationRequirement: {
      schemaVersion: "1.0.0",
      requirementId: id,
      capabilityId: "windows-process-restricted",
      minimumIsolationLevel,
      requiredProviderFeatures: ["CPU_LIMIT"],
      budgets: {
        maxCpuTimeMs: 1,
        maxMemoryBytes: 1_048_576,
        maxProcessCount: 1,
        maxWallClockMs: 1,
        maxStdoutBytes: 0,
        maxStderrBytes: 0,
      },
      downgradeAllowed: false,
    },
  };
}

test("missing and unknown requirements block without consulting the catalog", async () => {
  const throwingCatalog = {
    resolve: () => {
      throw new Error("catalog must not be consulted");
    },
  };
  const result = await executeRestrictedWorkerTask({}, throwingCatalog);
  assert.equal(result.status, "BLOCKED");

  const unknown = resolveIsolationProvider(
    {
      evidenceContext: { requirementId: id },
      isolationRequirement: {
        schemaVersion: "1.0.0",
        requirementId: id,
        capabilityId: "windows-process-restricted",
        minimumIsolationLevel: "PROCESS_RESTRICTED",
        requiredProviderFeatures: ["CPU_LIMIT"],
        budgets: {
          maxCpuTimeMs: 1,
          maxMemoryBytes: 1_048_576,
          maxProcessCount: 1,
          maxWallClockMs: 1,
          maxStdoutBytes: 0,
          maxStderrBytes: 0,
        },
        downgradeAllowed: false,
        unexpected: true,
      },
    },
    availableProbe,
  );
  assert.equal(unknown.status, "BLOCKED");
  assert.equal(unknown.reasonCode, "INVALID_ISOLATION_REQUIREMENT");
});

test("unavailable provider takes precedence without executing", () => {
  const result = resolveIsolationProvider(canonicalResolutionRequest(), {
    ...availableProbe,
    result: "UNAVAILABLE",
    reasonCodes: ["QUALIFICATION_UNAVAILABLE"],
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.reasonCode, "PROCESS_RESTRICTED_PROVIDER_UNAVAILABLE");

  for (const minimum of ["OS_SANDBOXED", "CONTAINER_ISOLATED", "REMOTE_ISOLATED"]) {
    const stronger = resolveIsolationProvider(canonicalResolutionRequest(minimum), {
      ...availableProbe,
      result: "UNAVAILABLE",
      reasonCodes: ["SIMULATED_LINUX"],
    });
    assert.equal(stronger.status, "BLOCKED");
    assert.equal(stronger.reasonCode, "MINIMUM_ISOLATION_LEVEL_UNAVAILABLE");
  }
});

test("selected Worker request executes through the exact adapter boundary", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Win32-only execution provider");
    return;
  }
  const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "whoami.exe");
  const executableSha256 = createHash("sha256")
    .update(await readFile(executable))
    .digest("hex");
  const stagingRoot = join(tmpdir(), `aseos-worker-integration-${process.pid}`);
  const requirement = {
    schemaVersion: "1.0.0",
    requirementId: id,
    capabilityId: "windows-process-restricted",
    minimumIsolationLevel: "PROCESS_RESTRICTED",
    requiredProviderFeatures: [
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
    ],
    budgets: {
      maxCpuTimeMs: 2_000,
      maxMemoryBytes: 67_108_864,
      maxProcessCount: 4,
      maxWallClockMs: 5_000,
      maxStdoutBytes: 65_536,
      maxStderrBytes: 65_536,
    },
    downgradeAllowed: false,
  };
  try {
    const result = await executeRestrictedWorkerTask(
      {
        toolRef: "windows-whoami",
        argv: [],
        stagingRoot,
        environment: {},
        environmentAllowlist: [],
        evidenceContext: {
          requirementId: id,
          taskId: id,
          executionId: id,
          evidenceRefs: [{ subjectType: "WorkerTask", subjectId: id }],
        },
        isolationRequirement: requirement,
        unknownWorkerMetadata: "must-not-cross-adapter-boundary",
      },
      createTrustedToolCatalog([
        {
          toolRef: "windows-whoami",
          toolVersion: "1.0.0",
          canonicalExecutablePath: executable,
          executableSha256,
        },
      ]),
    );
    assert.equal(result.status, "EXECUTED");
    if (result.status === "EXECUTED") {
      assert.equal(result.isolation.status, "SELECTED");
      assert.equal(result.execution.status, "COMPLETED");
      if (result.execution.status === "COMPLETED") {
        assert.equal(result.execution.exitCode, 0);
        assert.equal(result.execution.evidence.requirementId, id);
        assert.equal(result.execution.evidence.downgradeOccurred, false);
        assert.equal(result.execution.evidence.processTree.activeProcessCountAfterCompletion, 0);
        assert.equal(result.execution.evidence.result.outcome, "SUCCEEDED");
      }
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});
