import { createHash } from "node:crypto";
import { copyFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  adapterDist,
  catalogFor,
  compileProcessFixture,
  defaultLimits,
  requestFor,
  waitForProcessExit,
} from "./helpers.mjs";

function processIds(output) {
  return [...output.matchAll(/(?:ROOT|CHILD|GRANDCHILD|SPAWNED)=(\d+)/gu)].map((match) =>
    Number(match[1]),
  );
}

describe.skipIf(process.platform !== "win32")("Windows Job Object security qualification", () => {
  let adapter;
  let capability;
  let fixture;
  let fixtureCatalog;
  let stagingRoot;

  beforeAll(async () => {
    [adapter, fixture] = await Promise.all([
      import(pathToFileURL(adapterDist).href),
      compileProcessFixture(),
    ]);
    capability = await adapter.probeWindowsProcessRestrictedCapability();
    expect(capability.result).toBe("AVAILABLE");
    stagingRoot = join(fixture.outputRoot, "security staging 根");
    fixtureCatalog = catalogFor(fixture.executable, fixture.executableSha256);
  }, 60_000);

  afterAll(async () => {
    if (fixture !== undefined) {
      await rm(fixture.outputRoot, { recursive: true, force: true });
    }
  });

  function run(overrides = {}, catalog = fixtureCatalog) {
    return adapter.runWindowsProcessRestricted(
      requestFor(stagingRoot, overrides),
      catalog,
      capability,
    );
  }

  test("rejects digest mismatch, traversal, raw shells and invalid budgets", async () => {
    const mismatch = await run(
      {
        argv: ["smoke", "fixture input.txt"],
      },
      catalogFor(fixture.executable, "0".repeat(64)),
    );
    expect(mismatch).toMatchObject({ status: "FAILED_TO_START" });
    expect(mismatch.message).toMatch(/SHA-256 mismatch/u);

    const traversal = await run({
      inputs: [{ relativePath: "../escape.txt", content: "forbidden" }],
    });
    expect(traversal).toMatchObject({ status: "FAILED_TO_START" });
    expect(traversal.message).toMatch(/unsafe staged input|escapes working directory/u);

    const powershell = join(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const shell = await run({}, catalogFor(powershell, fixture.executableSha256));
    expect(shell).toMatchObject({ status: "FAILED_TO_START" });
    expect(shell.message).toMatch(/shell or script interpreter executable is forbidden/u);

    const renamedShell = join(fixture.outputRoot, "approved-tool.exe");
    await copyFile(
      join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe"),
      renamedShell,
    );
    const renamedShellSha256 = createHash("sha256")
      .update(await readFile(renamedShell))
      .digest("hex");
    const renamed = await run(
      { argv: ["/d", "/s", "/c", "echo SHELL_BOUNDARY_BYPASSED"], inputs: [] },
      catalogFor(renamedShell, renamedShellSha256),
    );
    expect(renamed).toMatchObject({ status: "FAILED_TO_START" });
    expect(renamed.message).toMatch(
      /Shell or script interpreter executable identity is forbidden/u,
    );

    const invalidBudget = await run({ limits: defaultLimits({ maxProcessCount: 0 }) });
    expect(invalidBudget).toMatchObject({ status: "FAILED_TO_START" });

    const preCancelled = new globalThis.AbortController();
    preCancelled.abort();
    expect(await run({ signal: preCancelled.signal })).toMatchObject({
      status: "FAILED_TO_START",
      code: "REQUEST_CANCELLED_BEFORE_START",
    });
  }, 60_000);

  test("bounds stdout and records canonical output-limit evidence", async () => {
    const result = await run({
      argv: ["stdout", "8192"],
      inputs: [],
      limits: defaultLimits({ maxStdoutBytes: 256 }),
    });
    expect(result).toMatchObject({
      status: "TERMINATED",
      reason: "OUTPUT_LIMIT",
      evidence: {
        result: { outcome: "FAILED", terminationReason: "OUTPUT_LIMIT" },
        processTree: { activeProcessCountAfterCompletion: 0 },
      },
    });
    expect(result.stdout.byteLength).toBe(256);
  }, 60_000);

  test("terminates the root, child and grandchild at wall-clock expiry", async () => {
    const result = await run({
      argv: ["tree-root"],
      inputs: [],
      limits: defaultLimits({ maxWallClockMs: 1200, maxProcessCount: 16 }),
    });
    expect(result).toMatchObject({
      status: "TERMINATED",
      reason: "WALL_CLOCK_LIMIT",
      evidence: {
        result: { outcome: "TIMED_OUT", terminationReason: "WALL_CLOCK_LIMIT" },
        processTree: {
          descendantTerminationVerified: true,
          activeProcessCountAfterCompletion: 0,
        },
      },
    });
    const ids = processIds(Buffer.from(result.stdout).toString("utf8"));
    expect(ids).toHaveLength(3);
    for (const processId of ids) expect(await waitForProcessExit(processId)).toBe(true);
  }, 60_000);

  test("cancels promptly by terminating the complete Job Object", async () => {
    const controller = new globalThis.AbortController();
    const started = Date.now();
    const pending = run({
      argv: ["tree-root"],
      inputs: [],
      signal: controller.signal,
      limits: defaultLimits({ maxWallClockMs: 20_000, maxProcessCount: 16 }),
    });
    globalThis.setTimeout(() => controller.abort(), 500);
    const result = await pending;
    expect(Date.now() - started).toBeLessThan(5000);
    expect(result).toMatchObject({
      status: "TERMINATED",
      reason: "CANCELLED",
      evidence: {
        result: { outcome: "CANCELLED", terminationReason: "CANCELLED" },
        processTree: { activeProcessCountAfterCompletion: 0 },
      },
    });
  }, 60_000);

  test("enforces CPU and memory budgets with explicit reasons", async () => {
    const cpu = await run({
      argv: ["cpu"],
      inputs: [],
      limits: defaultLimits({ maxCpuTimeMs: 150, maxWallClockMs: 10_000 }),
    });
    expect(cpu).toMatchObject({
      status: "TERMINATED",
      reason: "CPU_LIMIT",
      evidence: { result: { terminationReason: "CPU_LIMIT" } },
    });

    const memory = await run({
      argv: ["memory"],
      inputs: [],
      limits: defaultLimits({ maxMemoryBytes: 48 * 1024 * 1024, maxWallClockMs: 10_000 }),
    });
    expect(memory).toMatchObject({
      status: "TERMINATED",
      reason: "MEMORY_LIMIT",
      evidence: { result: { terminationReason: "MEMORY_LIMIT" } },
    });
  }, 60_000);

  test("enforces the active-process budget", async () => {
    const result = await run({
      argv: ["spawn-child"],
      inputs: [],
      limits: defaultLimits({ maxProcessCount: 1 }),
    });
    expect(result).toMatchObject({
      status: "TERMINATED",
      reason: "PROCESS_COUNT_LIMIT",
      evidence: { result: { terminationReason: "PROCESS_COUNT_LIMIT" } },
    });
    expect(result.evidence.processTree.activeProcessCountAfterCompletion).toBe(0);
    for (const processId of processIds(Buffer.from(result.stdout).toString("utf8"))) {
      expect(await waitForProcessExit(processId)).toBe(true);
    }
  }, 60_000);
});
