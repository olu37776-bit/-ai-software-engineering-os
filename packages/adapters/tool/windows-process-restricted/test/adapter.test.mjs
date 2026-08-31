import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createTrustedToolCatalog,
  probeWindowsProcessRestrictedCapability,
  runWindowsProcessRestricted,
} from "../dist/index.js";

const id = "019a0597-c903-7a4f-8842-efb9791bf690";

async function whoamiFixture(stagingRoot, overrides = {}) {
  const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "whoami.exe");
  const executableSha256 = createHash("sha256")
    .update(await readFile(executable))
    .digest("hex");
  return {
    catalog: createTrustedToolCatalog([
      {
        toolRef: "windows-whoami",
        toolVersion: "1.0.0",
        canonicalExecutablePath: executable,
        executableSha256,
      },
    ]),
    request: {
      toolRef: "windows-whoami",
      argv: [],
      stagingRoot,
      environment: {},
      environmentAllowlist: [],
      limits: {
        maxCpuTimeMs: 2_000,
        maxMemoryBytes: 67_108_864,
        maxProcessCount: 4,
        maxWallClockMs: 5_000,
        maxStdoutBytes: 65_536,
        maxStderrBytes: 65_536,
      },
      evidenceContext: {
        requirementId: id,
        taskId: id,
        executionId: id,
        evidenceRefs: [{ subjectType: "WorkerTask", subjectId: id }],
      },
      ...overrides,
    },
  };
}

test("capability probe is fail-closed and canonical", async () => {
  const report = await probeWindowsProcessRestrictedCapability();
  assert.equal(report.schemaVersion, "1.0.0");
  assert.equal(report.isolationLevel, "PROCESS_RESTRICTED");
  assert.equal(report.providerId, "aseos.windows-job-object");
  assert.equal(report.guarantees.networkAccessDenied, false);
  assert.equal(report.guarantees.filesystemAccessDenied, false);
  assert.equal(report.guarantees.registryAccessDenied, false);
  if (process.platform === "win32") assert.equal(report.result, "AVAILABLE");
  else assert.equal(report.result, "UNAVAILABLE");
});

test("executes a digest-pinned native tool without shell fallback", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Win32-only execution provider");
    return;
  }
  const executable = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "whoami.exe");
  const expectedExecutableSha256 = createHash("sha256")
    .update(await readFile(executable))
    .digest("hex");
  const stagingRoot = join(tmpdir(), `aseos-adapter-test-${process.pid}`);
  const trustedCatalog = createTrustedToolCatalog([
    {
      toolRef: "windows-whoami",
      toolVersion: "1.0.0",
      canonicalExecutablePath: executable,
      executableSha256: expectedExecutableSha256,
    },
  ]);
  try {
    const result = await runWindowsProcessRestricted(
      {
        toolRef: "windows-whoami",
        argv: [],
        stagingRoot,
        environment: {},
        environmentAllowlist: [],
        limits: {
          maxCpuTimeMs: 2_000,
          maxMemoryBytes: 67_108_864,
          maxProcessCount: 4,
          maxWallClockMs: 5_000,
          maxStdoutBytes: 65_536,
          maxStderrBytes: 65_536,
        },
        evidenceContext: {
          requirementId: id,
          taskId: id,
          executionId: id,
          evidenceRefs: [{ subjectType: "WorkerTask", subjectId: id }],
        },
      },
      trustedCatalog,
    );
    assert.equal(result.status, "COMPLETED");
    if (result.status === "COMPLETED") {
      assert.equal(result.exitCode, 0);
      assert.equal(result.evidence.downgradeOccurred, false);
      assert.equal(result.evidence.processTree.activeProcessCountAfterCompletion, 0);
      assert.equal(result.evidence.result.outcome, "SUCCEEDED");
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});

test("rejects a renamed shell by signed PE identity", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Win32-only execution provider");
    return;
  }
  const testRoot = join(tmpdir(), `aseos-renamed-shell-test-${process.pid}`);
  const renamedShell = join(testRoot, "trusted-fixture.exe");
  await mkdir(testRoot, { recursive: true });
  try {
    await copyFile(
      join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
      renamedShell,
    );
    const executableSha256 = createHash("sha256")
      .update(await readFile(renamedShell))
      .digest("hex");
    const result = await runWindowsProcessRestricted(
      {
        toolRef: "renamed-shell-fixture",
        argv: ["/c", "exit", "0"],
        stagingRoot: testRoot,
        limits: {
          maxCpuTimeMs: 2_000,
          maxMemoryBytes: 67_108_864,
          maxProcessCount: 4,
          maxWallClockMs: 5_000,
          maxStdoutBytes: 0,
          maxStderrBytes: 0,
        },
        evidenceContext: {
          requirementId: id,
          taskId: id,
          executionId: id,
          evidenceRefs: [{ subjectType: "WorkerTask", subjectId: id }],
        },
      },
      createTrustedToolCatalog([
        {
          toolRef: "renamed-shell-fixture",
          toolVersion: "1.0.0",
          canonicalExecutablePath: renamedShell,
          executableSha256,
        },
      ]),
    );
    assert.equal(result.status, "FAILED_TO_START");
    if (result.status === "FAILED_TO_START") {
      assert.match(result.message, /identity is forbidden/i);
    }
  } finally {
    await rm(testRoot, { recursive: true, force: true });
  }
});

test("rejects non-canonical evidence and authority injection before staging", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Win32-only execution provider");
    return;
  }
  const cases = [
    {
      evidenceContext: {
        requirementId: "not-a-uuid",
        taskId: id,
        executionId: id,
        evidenceRefs: [{ subjectType: "WorkerTask", subjectId: id }],
      },
    },
    { evidenceContext: { requirementId: id, taskId: id, executionId: id, evidenceRefs: [] } },
    {
      evidenceContext: {
        requirementId: id,
        taskId: id,
        executionId: id,
        evidenceRefs: [
          { subjectType: "WorkerTask", subjectId: id },
          { subjectType: "WorkerTask", subjectId: id },
        ],
      },
    },
    {
      executable: "C:\\Windows\\System32\\cmd.exe",
      trustedTool: { executableSha256: "0".repeat(64) },
    },
  ];
  for (const [index, overrides] of cases.entries()) {
    const stagingRoot = join(tmpdir(), `aseos-invalid-request-${process.pid}-${index}`);
    const fixture = await whoamiFixture(stagingRoot, overrides);
    const result = await runWindowsProcessRestricted(fixture.request, fixture.catalog);
    assert.equal(result.status, "FAILED_TO_START");
    await assert.rejects(access(stagingRoot));
  }
});

test("pre-cancelled requests never resolve a catalog or start", async () => {
  const result = await runWindowsProcessRestricted(
    { signal: { aborted: true } },
    {
      resolve: () => {
        throw new Error("catalog must not be consulted");
      },
    },
  );
  assert.equal(result.status, "FAILED_TO_START");
  if (result.status === "FAILED_TO_START")
    assert.equal(result.code, "REQUEST_CANCELLED_BEFORE_START");
});

test("zero stdout budget enters execution and terminates as OUTPUT_LIMIT", async (context) => {
  if (process.platform !== "win32") {
    context.skip("Win32-only execution provider");
    return;
  }
  const stagingRoot = join(tmpdir(), `aseos-zero-output-${process.pid}`);
  try {
    const fixture = await whoamiFixture(stagingRoot);
    fixture.request.limits.maxStdoutBytes = 0;
    const result = await runWindowsProcessRestricted(fixture.request, fixture.catalog);
    assert.equal(result.status, "TERMINATED");
    if (result.status === "TERMINATED") {
      assert.equal(result.reason, "OUTPUT_LIMIT");
      assert.equal(result.evidence.result.terminationReason, "OUTPUT_LIMIT");
      assert.equal(result.evidence.usage.stdoutBytes, 0);
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
});
