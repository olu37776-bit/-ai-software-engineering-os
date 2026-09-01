import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const repositoryRoot = resolve(import.meta.dirname, "../../..");
export const adapterDist = resolve(
  repositoryRoot,
  "packages/adapters/tool/windows-process-restricted/dist/index.js",
);
export const workerDist = resolve(repositoryRoot, "apps/worker/dist/index.js");

const fixedEvidenceContext = Object.freeze({
  requirementId: "018f47a2-1000-7000-8000-000000000001",
  taskId: "018f47a2-1000-7000-8000-000000000002",
  executionId: "018f47a2-1000-7000-8000-000000000003",
  evidenceRefs: [
    {
      subjectType: "Operation",
      subjectId: "P1-O07",
      subjectVersion: "1.0.0",
    },
  ],
});
export const fixtureToolRef = "aseos.p1-o07.fixture";

export function defaultLimits(overrides = {}) {
  return {
    maxCpuTimeMs: 15_000,
    maxMemoryBytes: 128 * 1024 * 1024,
    maxProcessCount: 8,
    maxWallClockMs: 15_000,
    maxStdoutBytes: 64 * 1024,
    maxStderrBytes: 64 * 1024,
    ...overrides,
  };
}

export function requestFor(stagingRoot, overrides = {}) {
  return {
    toolRef: fixtureToolRef,
    argv: ["smoke", "fixture input.txt"],
    stagingRoot,
    inputs: [{ relativePath: "fixture input.txt", content: "受控输入" }],
    environment: {
      ASEOS_ALLOWED: "visible",
      ASEOS_SECRET: "must-not-be-inherited",
    },
    environmentAllowlist: ["ASEOS_ALLOWED"],
    limits: defaultLimits(),
    evidenceContext: fixedEvidenceContext,
    ...overrides,
  };
}

export function catalogFor(executable, executableSha256, descriptorOverrides = {}) {
  const descriptor = {
    toolRef: fixtureToolRef,
    toolVersion: "1.0.0",
    canonicalExecutablePath: executable,
    executableSha256,
    ...descriptorOverrides,
  };
  return {
    resolve(toolRef) {
      return toolRef === descriptor.toolRef ? descriptor : undefined;
    },
  };
}

export function canonicalRequirement(budgets = defaultLimits()) {
  return {
    schemaVersion: "1.0.0",
    requirementId: fixedEvidenceContext.requirementId,
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
    budgets,
    downgradeAllowed: false,
  };
}

async function firstExisting(paths) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // Try the next fixed framework compiler path.
    }
  }
  throw new Error("The Windows .NET Framework C# compiler is unavailable");
}

export async function compileProcessFixture() {
  if (process.platform !== "win32") return undefined;
  const windowsRoot = process.env.SystemRoot ?? "C:\\Windows";
  const compiler = await firstExisting([
    join(windowsRoot, "Microsoft.NET", "Framework64", "v4.0.30319", "csc.exe"),
    join(windowsRoot, "Microsoft.NET", "Framework", "v4.0.30319", "csc.exe"),
  ]);
  const outputRoot = await mkdtemp(join(tmpdir(), "aseos P1-O07 中文 "));
  const executable = join(outputRoot, "process restricted fixture.exe");
  const source = resolve(
    repositoryRoot,
    "tests/security/isolation/fixtures/ProcessRestrictedFixture.cs",
  );
  await execFileAsync(compiler, ["/nologo", "/target:exe", `/out:${executable}`, source], {
    windowsHide: true,
  });
  const executableSha256 = createHash("sha256")
    .update(await readFile(executable))
    .digest("hex");
  return { executable, executableSha256, outputRoot };
}

export async function removeProcessFixture(fixture) {
  await rm(fixture.outputRoot, {
    recursive: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

export async function isProcessAlive(processId) {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForProcessExit(processId, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isProcessAlive(processId))) return true;
    await new Promise((resolvePromise) => globalThis.setTimeout(resolvePromise, 50));
  }
  return !(await isProcessAlive(processId));
}
