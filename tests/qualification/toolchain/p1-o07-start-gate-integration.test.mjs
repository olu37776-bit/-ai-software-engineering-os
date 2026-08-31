import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const baseCommit = "ce7373c980141ba65e1ba9b65592fdbedc6029b8";
const gatePath =
  "operations/phase-1/evidence/o01/p1-o07-start-after-issue-71-independent-gate.json";
const temporaryDirectories = [];

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
}

function runPass(command, args, cwd) {
  const result = run(command, args, cwd);
  expect(result.status, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

function git(cwd, ...args) {
  return runPass("git", args, cwd);
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function makeRepository() {
  const parent = await mkdtemp(join(tmpdir(), "aseos-issue71-"));
  temporaryDirectories.push(parent);
  const repository = join(parent, "repo");
  runPass("git", ["clone", "--quiet", "--no-hardlinks", root, repository], parent);
  git(repository, "config", "user.name", "Issue 71 test");
  git(repository, "config", "user.email", "issue71-test@example.invalid");
  git(repository, "checkout", "--quiet", "-B", "simulated-main", baseCommit);
  for (const path of ["scripts/toolchain/scope-policy.mjs", "scripts/toolchain/verify-scope.mjs"]) {
    await writeFile(join(repository, path), await readFile(join(root, path)));
  }
  git(
    repository,
    "add",
    "scripts/toolchain/scope-policy.mjs",
    "scripts/toolchain/verify-scope.mjs",
  );
  git(repository, "commit", "--quiet", "-m", "test: install Issue 71 transition enforcement");
  return { repository, enforcementBase: git(repository, "rev-parse", "HEAD") };
}

async function createP1O07Operation(repository, operationBase, branch, suffix) {
  git(repository, "checkout", "--quiet", "-B", branch, operationBase);
  const executionPath = `operations/phase-1/executions/p1-o07-${suffix}.json`;
  await writeJson(join(repository, executionPath), {
    schemaVersion: "1.0.0",
    executionId: `P1-O07-${suffix.toUpperCase()}`,
    executionType: "P1_O07_WINDOWS_ISOLATION_TRANSITION",
    operationId: "P1-O07",
    writeScopeOperationId: "P1-O07",
    implementationBranch: branch,
    baseCommit: operationBase,
  });
  const probePath = "packages/contracts/examples/isolation/issue71-probe.json";
  await mkdir(join(repository, "packages/contracts/examples/isolation"), { recursive: true });
  await writeJson(join(repository, probePath), { issue71Probe: true });
  git(repository, "add", executionPath, probePath);
  git(repository, "commit", "--quiet", "-m", `test: ${suffix}`);
  return git(repository, "rev-parse", "HEAD");
}

function runScope(repository, base, head, branch) {
  return run(
    process.execPath,
    [
      "scripts/toolchain/verify-scope.mjs",
      "--operation",
      "P1-O07",
      "--base",
      base,
      "--head",
      head,
      "--branch",
      branch,
      "--event",
      "local",
    ],
    repository,
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Issue #71 P1-O07 executable start Gate routing", () => {
  test("fails closed without a legal P1-O07 operation context", async () => {
    const { repository, enforcementBase } = await makeRepository();
    const branch = "phase-1/test-p1-o07-missing-operation-context";
    git(repository, "checkout", "--quiet", "-B", branch, enforcementBase);

    const result = runScope(repository, enforcementBase, enforcementBase, branch);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MISSING_OPERATION_CONTEXT");
  }, 30_000);

  test("fails the real operation-aware preflight closed for an absent or malformed Gate", async () => {
    const { repository, enforcementBase } = await makeRepository();

    const absentBranch = "phase-1/test-p1-o07-absent-gate";
    const absentHead = await createP1O07Operation(
      repository,
      enforcementBase,
      absentBranch,
      "issue71-absent-gate",
    );
    const absent = runScope(repository, enforcementBase, absentHead, absentBranch);
    expect(absent.status).toBe(1);
    expect(absent.stderr).toContain("P1_O07_START_BLOCKED");
    expect(absent.stderr).toContain("is absent from authorized base");

    git(repository, "checkout", "--quiet", "-B", "simulated-main", enforcementBase);
    await writeJson(join(repository, gatePath), {
      schemaVersion: "1.0.0",
      evidenceType: "IndependentPhase1TransitionGate",
      trackingIssue: 71,
      decision: "FAIL",
    });
    git(repository, "add", gatePath);
    git(repository, "commit", "--quiet", "-m", "test: malformed P1-O07 Gate");
    const malformedBase = git(repository, "rev-parse", "HEAD");
    const malformedBranch = "phase-1/test-p1-o07-malformed-gate";
    const malformedHead = await createP1O07Operation(
      repository,
      malformedBase,
      malformedBranch,
      "issue71-malformed-gate",
    );
    const malformed = runScope(repository, malformedBase, malformedHead, malformedBranch);
    expect(malformed.status).toBe(1);
    expect(malformed.stderr).toContain(
      "P1_O07_START_BLOCKED: Issue #71 independent PASS Gate is missing or invalid",
    );
  }, 30_000);
});
