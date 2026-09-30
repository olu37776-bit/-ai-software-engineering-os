import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  P2_O01_ACCEPTED_MAIN,
  P2_O02_BRANCH,
} from "../../../scripts/toolchain/phase2-scope-o02-policy.mjs";
import { verifyP2O02GeneratedTypeCommitment } from "../../../scripts/toolchain/phase2-scope-o02.mjs";
import { generateContractTypeSource } from "../../../scripts/contracts/type-model.mjs";
import { assertGeneratedTypeSourceCurrent } from "../../../scripts/contracts/generate-contract-types.mjs";

const root = resolve(import.meta.dirname, "../../..");
let temporaryDirectory;
let repository;
let subject;
function run(cwd, command, args) {
  return spawnSync(command, args, { cwd, encoding: "utf8", shell: false });
}
function git(cwd, ...args) {
  const result = run(cwd, "git", args);
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}
beforeAll(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "aseos-o02-no-dependencies-"));
  repository = join(temporaryDirectory, "repo");
  git(temporaryDirectory, "clone", "--quiet", "--no-hardlinks", root, repository);
  git(repository, "config", "user.name", "O02 dependency-free scope fixture");
  git(repository, "config", "user.email", "o02-fixture@example.invalid");
  // Keep the historical O02 generation inputs stable when later operations add schemas.
  git(
    repository,
    "checkout",
    "--quiet",
    "-B",
    P2_O02_BRANCH,
    "0d7f8678403af4b401c4888804da0766c3a2346d",
  );
  for (const path of [
    "scripts/toolchain/phase2-scope-o02-policy.mjs",
    "scripts/toolchain/phase2-scope-o02.mjs",
  ]) {
    await writeFile(join(repository, path), await readFile(join(root, path)));
  }
  git(
    repository,
    "add",
    "scripts/toolchain/phase2-scope-o02-policy.mjs",
    "scripts/toolchain/phase2-scope-o02.mjs",
  );
  git(
    repository,
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "test: dependency-free exact generation commitment",
  );
  subject = git(repository, "rev-parse", "HEAD");
}, 60_000);
afterAll(async () => {
  if (temporaryDirectory) {
    expect(resolve(temporaryDirectory).startsWith(resolve(tmpdir()))).toBe(true);
    expect(temporaryDirectory).toContain("aseos-o02-no-dependencies-");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

describe("O02 independent scope without node_modules", () => {
  test("real formatter-backed generation still matches the pinned output byte for byte", async () => {
    const expected = await generateContractTypeSource(repository);
    const actual = await readFile(
      join(repository, "packages/contracts/src/types.generated.ts"),
      "utf8",
    );
    expect(() => assertGeneratedTypeSourceCurrent(actual, expected)).not.toThrow();
    expect(() =>
      assertGeneratedTypeSourceCurrent(actual.replaceAll("\r\n", "\n") + "\n", expected),
    ).toThrow("SCHEMA_TYPE_GENERATION_DRIFT");
    expect((await verifyP2O02GeneratedTypeCommitment(repository)).schemaFiles).toBe(53);
  });
  test("clean clone has no dependencies, scope and independent M0 both PASS without writes", async () => {
    await expect(access(join(repository, "node_modules"))).rejects.toThrow();
    const oldGeneration = run(repository, process.execPath, [
      "scripts/contracts/generate-contract-types.mjs",
      "--check",
    ]);
    expect(oldGeneration.status).not.toBe(0);
    expect(oldGeneration.stderr).toContain("ERR_MODULE_NOT_FOUND");
    expect(oldGeneration.stderr).toContain("prettier");
    const before = git(repository, "status", "--porcelain");
    const scoped = run(repository, process.execPath, [
      "scripts/toolchain/verify-scope.mjs",
      "--base",
      P2_O01_ACCEPTED_MAIN,
      "--head",
      subject,
      "--branch",
      P2_O02_BRANCH,
    ]);
    expect(scoped.status, scoped.stderr).toBe(0);
    const report = JSON.parse(scoped.stdout);
    expect(report.generatedTypes).toMatchObject({
      mode: "EXACT_QUALIFIED_INPUT_OUTPUT_COMMITMENT",
      schemaFiles: 53,
      pinnedFiles: 7,
    });
    const scopePath = join(temporaryDirectory, "scope.json");
    await writeFile(scopePath, scoped.stdout);
    const verified = run(repository, "python", [
      "scripts/governance/verify_m0.py",
      "--base",
      P2_O01_ACCEPTED_MAIN,
      "--head",
      subject,
      "--branch",
      P2_O02_BRANCH,
      "--scope-report",
      scopePath,
      "--subject",
      subject,
    ]);
    expect(verified.status, verified.stdout + verified.stderr).toBe(0);
    expect(JSON.parse(verified.stdout).summary).toEqual({ passed: 14, failed: 0, total: 14 });
    expect(git(repository, "status", "--porcelain")).toBe(before);
    const forged = {
      ...report,
      generatedTypes: { ...report.generatedTypes, outputHash: "f".repeat(64) },
    };
    await writeFile(scopePath, JSON.stringify(forged));
    const forgedVerification = run(repository, "python", [
      "scripts/governance/verify_m0.py",
      "--base",
      P2_O01_ACCEPTED_MAIN,
      "--head",
      subject,
      "--branch",
      P2_O02_BRANCH,
      "--scope-report",
      scopePath,
    ]);
    expect(forgedVerification.status).toBe(1);
    expect(forgedVerification.stderr).toContain("Forged or mismatched Phase 2 scope report");
  }, 60_000);
  test.each([
    "packages/contracts/src/types.generated.ts",
    "packages/contracts/type-bindings.json",
    "packages/contracts/schema-registry.json",
    "packages/contracts/schemas/persistence/result-journal-append-batch.schema.json",
    "packages/contracts/schemas/common/actor-ref.schema.json",
    "scripts/contracts/type-model.mjs",
    "scripts/contracts/generate-contract-types.mjs",
    "package.json",
    "pnpm-lock.yaml",
  ])("rejects any exact generation input/output mutation: %s", async (path) => {
    const original = await readFile(join(repository, path));
    try {
      await writeFile(join(repository, path), Buffer.concat([original, Buffer.from("\n")]));
      await expect(verifyP2O02GeneratedTypeCommitment(repository)).rejects.toThrow(
        /P2_O02_GENERATION_(COMMITMENT_MISMATCH|INVALID_LINE_ENDINGS)/,
      );
    } finally {
      await writeFile(join(repository, path), original);
    }
  });
  test("allows uniform CRLF but rejects mixed line endings like the real generator", async () => {
    const path = join(repository, "packages/contracts/src/types.generated.ts");
    const original = await readFile(path);
    const lf = original.toString("utf8").replaceAll("\r\n", "\n");
    try {
      await writeFile(path, lf.replaceAll("\n", "\r\n"));
      await expect(verifyP2O02GeneratedTypeCommitment(repository)).resolves.toMatchObject({
        schemaFiles: 53,
      });
      await writeFile(path, lf.replace("\n", "\r\n"));
      await expect(verifyP2O02GeneratedTypeCommitment(repository)).rejects.toThrow(
        "P2_O02_GENERATION_INVALID_LINE_ENDINGS",
      );
    } finally {
      await writeFile(path, original);
    }
  });
});
