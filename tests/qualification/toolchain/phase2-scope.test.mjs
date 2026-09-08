import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

import {
  P1_ACCEPTED_HEAD,
  P1_ACCEPTED_MAIN,
  PHASE2_CHECK,
  PHASE2_EXECUTION,
  PHASE2_EXACT_PATHS,
  PHASE2_PREFIXES,
  phase2PathAllowed,
  validatePhase2Declarations,
  validatePhase2RequiredScripts,
} from "../../../scripts/toolchain/phase2-scope-policy.mjs";

const root = resolve(import.meta.dirname, "../../..");
const branch = "phase-2/p2-o01-durable-workflow";
const temporaryDirectories = [];

function run(repository, command, args) {
  return spawnSync(command, args, { cwd: repository, encoding: "utf8", shell: false });
}

function git(repository, ...args) {
  const result = run(repository, "git", args);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

async function writeJson(repository, path, value) {
  await mkdir(dirname(join(repository, path)), { recursive: true });
  await writeFile(join(repository, path), `${JSON.stringify(value, null, 2)}\n`);
}

async function fixture() {
  const parent = await mkdtemp(join(tmpdir(), "aseos-phase2-scope-"));
  temporaryDirectories.push(parent);
  const repository = join(parent, "repo");
  git(parent, "clone", "--quiet", "--no-hardlinks", root, repository);
  git(repository, "config", "user.name", "Phase 2 scope fixture");
  git(repository, "config", "user.email", "phase2-fixture@example.invalid");
  // Use the genuine protected-main P1 merge, not a synthetic authorization.
  const base = P1_ACCEPTED_MAIN;
  git(repository, "checkout", "--quiet", "-B", branch, base);
  for (const path of [
    "scripts/toolchain/verify-scope.mjs",
    "scripts/toolchain/phase2-scope.mjs",
    "scripts/toolchain/phase2-scope-policy.mjs",
    "scripts/governance/verify_m0.py",
    "operations/phase-2/operation.json",
    "operations/phase-2/write-scope.json",
    "operations/phase-2/verification-plan.json",
    "operations/phase-2/result-format.json",
    PHASE2_EXECUTION,
  ]) {
    await mkdir(dirname(join(repository, path)), { recursive: true });
    await writeFile(join(repository, path), await readFile(join(root, path)));
  }
  const operation = JSON.parse(
    await readFile(join(repository, "operations/phase-2/operation.json"), "utf8"),
  );
  operation.acceptedP1MainCommit = base;
  await writeJson(repository, "operations/phase-2/operation.json", operation);
  const execution = JSON.parse(await readFile(join(repository, PHASE2_EXECUTION), "utf8"));
  execution.baseCommit = base;
  await writeJson(repository, PHASE2_EXECUTION, execution);
  git(repository, "add", ".");
  git(repository, "commit", "--quiet", "-m", "test: bounded Phase 2 bootstrap");
  return { parent, repository, base, head: git(repository, "rev-parse", "HEAD") };
}

function scope(f, extra = []) {
  return run(f.repository, process.execPath, [
    "scripts/toolchain/verify-scope.mjs",
    "--base",
    f.base,
    "--head",
    f.head,
    "--branch",
    branch,
    ...extra,
  ]);
}

afterEach(async () => {
  for (const path of temporaryDirectories.splice(0)) {
    expect(
      resolve(path).startsWith(resolve(tmpdir()) + "/") ||
        resolve(path).startsWith(resolve(tmpdir()) + "\\"),
    ).toBe(true);
    expect(path).toContain("aseos-phase2-scope-");
    await rm(path, { recursive: true, force: true });
  }
});

describe("Phase 2 deny-by-default transition", () => {
  test("existing required checks cannot be removed or replaced by successful no-ops", () => {
    const baseline = {
      scripts: {
        quality: "pnpm run lint && pnpm run test",
        lint: "eslint .",
        test: "vitest run",
        format: "prettier --check package.json",
      },
    };
    const extension = {
      scripts: {
        ...baseline.scripts,
        quality: "pnpm run lint && pnpm run kernel:qualify && pnpm run test",
        "kernel:qualify": "pnpm run build && node scripts/qualification/kernel/qualify-kernel.mjs",
      },
    };
    expect(() => validatePhase2RequiredScripts(baseline, extension)).not.toThrow();
    expect(() =>
      validatePhase2RequiredScripts(baseline, {
        scripts: { ...extension.scripts, test: 'node -e "process.exit(0)"' },
      }),
    ).toThrow("P2_REQUIRED_SCRIPT_CHANGED");
    expect(() =>
      validatePhase2RequiredScripts(baseline, {
        scripts: { ...extension.scripts, quality: "pnpm run kernel:qualify" },
      }),
    ).toThrow("P2_REQUIRED_QUALITY_WEAKENED");
    expect(() =>
      validatePhase2RequiredScripts(baseline, {
        scripts: { ...extension.scripts, format: baseline.scripts.format + " || true" },
      }),
    ).toThrow("P2_REQUIRED_FORMAT_WEAKENED");
  });
  test("allowlist admits only the first slice and never frozen P1/ADR/schema changes", () => {
    for (const path of [
      "packages/kernel/src/index.ts",
      "packages/workflow/src/index.ts",
      "packages/platform/src/workflow-service.ts",
      "tests/qualification/toolchain/phase2-scope.test.mjs",
    ]) {
      expect(phase2PathAllowed(path)).toBe(true);
    }
    for (const path of [
      "operations/phase-1/authority-lock.json",
      "operations/phase-1/implementation-receipt.json",
      "docs/decisions/ADR-0001-full-rebuild.md",
      "packages/contracts/schema-registry.json",
      ".github/workflows/quality.yml",
      "packages/policy/src/index.ts",
      "operations/phase-2/executions/p2-o99.json",
      "packages/kernel/../policy/escape.ts",
      "packages/kernel/control\tname.ts",
    ]) {
      expect(phase2PathAllowed(path), path).toBe(false);
    }
  });

  test("a declaration cannot broaden the hardcoded scope or self-declare completion", async () => {
    const operation = JSON.parse(
      await readFile(join(root, "operations/phase-2/operation.json"), "utf8"),
    );
    operation.acceptedP1MainCommit = P1_ACCEPTED_MAIN;
    const execution = {
      schemaVersion: "1.0.0",
      operationId: "P2-O01",
      implementationBranch: branch,
      baseCommit: P1_ACCEPTED_MAIN,
      status: "IN_PROGRESS",
      phase2Complete: false,
    };
    const declaredScope = {
      schemaVersion: "1.0.0",
      operationId: "P2-O01",
      enforcementMode: "DENY_BY_DEFAULT",
      exactPaths: PHASE2_EXACT_PATHS,
      prefixes: PHASE2_PREFIXES,
    };
    expect(() =>
      validatePhase2Declarations({ operation, scope: declaredScope, execution }),
    ).not.toThrow();
    expect(() =>
      validatePhase2Declarations({
        operation,
        scope: { ...declaredScope, prefixes: [...PHASE2_PREFIXES, "packages/"] },
        execution,
      }),
    ).toThrow("P2_SCOPE_DECLARATION_MISMATCH");
    expect(() =>
      validatePhase2Declarations({
        operation,
        scope: declaredScope,
        execution: { ...execution, phase2Complete: true },
      }),
    ).toThrow("P2_INVALID_EXECUTION");
  });

  test("dispatches execution and exact no-content-change merge, preserving accepted P1", async () => {
    const f = await fixture();
    const execution = scope(f);
    expect(execution.status, execution.stderr).toBe(0);
    const report = JSON.parse(execution.stdout);
    expect(report).toMatchObject({
      check: PHASE2_CHECK,
      mode: "PHASE2_OPERATION_EXECUTION",
      p1HumanAcceptance: "PASS",
      phase2Complete: false,
    });
    const merge = git(
      f.repository,
      "commit-tree",
      git(f.repository, "rev-parse", "HEAD^{tree}"),
      "-p",
      f.base,
      "-p",
      f.head,
      "-m",
      "test: synthetic P2 merge",
    );
    git(f.repository, "checkout", "--quiet", "-B", "main", merge);
    const merged = scope({ ...f, head: merge }, ["--branch", "main", "--event", "push"]);
    expect(merged.status, merged.stderr).toBe(0);
    expect(JSON.parse(merged.stdout).mode).toBe("PHASE2_OPERATION_MERGE");
  }, 60_000);

  test("fails closed for unlanded baseline, wrong operation/branch and out-of-scope files", async () => {
    const f = await fixture();
    for (const args of [
      ["--operation", "P2-O99"],
      ["--branch", "phase-2/unregistered"],
      ["--base", P1_ACCEPTED_HEAD],
      ["--event", "unknown"],
    ]) {
      expect(scope(f, args).status, JSON.stringify(args)).toBe(1);
    }
    await writeFile(join(f.repository, "packages/policy/out-of-scope.txt"), "unapproved\n");
    expect(scope(f).stderr).toContain("P2_OUT_OF_SCOPE");
    await rm(join(f.repository, "packages/policy/out-of-scope.txt"));
    const operationPath = "operations/phase-2/operation.json";
    const operation = JSON.parse(await readFile(join(f.repository, operationPath), "utf8"));
    await writeJson(f.repository, operationPath, { ...operation, acceptedP1MainCommit: null });
    expect(scope(f).stderr).toContain("P2_INVALID_OPERATION_AUTHORIZATION");
  }, 60_000);

  test("does not accept mutation of frozen receipt or authority even when code paths are allowed", async () => {
    const f = await fixture();
    await writeFile(join(f.repository, "operations/phase-1/implementation-receipt.json"), "{}\n");
    expect(scope(f).stderr).toContain("P2_OUT_OF_SCOPE");
  }, 60_000);

  test("M0 independently recomputes exact scope and rejects fabricated PASS details", async () => {
    const f = await fixture();
    const result = scope(f);
    expect(result.status, result.stderr).toBe(0);
    const reportPath = join(f.parent, "scope.json");
    const report = JSON.parse(result.stdout);
    await writeFile(reportPath, JSON.stringify(report));
    const args = [
      "scripts/governance/verify_m0.py",
      "--base",
      f.base,
      "--head",
      f.head,
      "--branch",
      branch,
      "--scope-report",
      reportPath,
    ];
    const valid = run(f.repository, "python", args);
    expect(valid.status, valid.stdout + valid.stderr).toBe(0);
    expect(
      JSON.parse(valid.stdout).checks.find(
        (check) => check.id === "M0-V13-OPERATION-AWARE-TRANSITION",
      )?.detail.scopeIndependentlyRecomputed,
    ).toBe(true);
    await writeFile(reportPath, JSON.stringify({ ...report, acceptedP1Head: "f".repeat(40) }));
    const forged = run(f.repository, "python", args);
    expect(forged.status).toBe(1);
    expect(forged.stderr).toContain("Forged or mismatched Phase 2 scope report");
    await writeFile(
      reportPath,
      JSON.stringify({
        ...report,
        check: "PHASE1_OPERATION_AWARE_WRITE_SCOPE",
        mode: "OPERATION_EXECUTION",
        operationId: "P1-O09",
      }),
    );
    expect(run(f.repository, "python", args).status).toBe(1);
  }, 60_000);
});
