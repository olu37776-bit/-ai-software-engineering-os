import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, test } from "vitest";

import { resolvePostMergeTarget } from "../../../scripts/toolchain/resolve-post-merge-target.mjs";

const root = resolve(import.meta.dirname, "../../..");
const temporaryDirectories = [];

function git(repository, ...args) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    shell: false,
  });
  expect(result.status, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`).toBe(0);
  return result.stdout.trim();
}

async function makeHistory() {
  const repository = await mkdtemp(join(tmpdir(), "aseos-post-merge-"));
  temporaryDirectories.push(repository);
  git(repository, "init", "--quiet", "--initial-branch=main");
  git(repository, "config", "user.name", "Issue 33 test");
  git(repository, "config", "user.email", "issue33-test@example.invalid");
  await writeFile(join(repository, "subject.txt"), "initial\n", "utf8");
  git(repository, "add", "subject.txt");
  git(repository, "commit", "--quiet", "-m", "initial");
  const initialCommit = git(repository, "rev-parse", "HEAD");

  git(repository, "checkout", "--quiet", "-b", "feature-one");
  await writeFile(join(repository, "feature-one.txt"), "one\n", "utf8");
  git(repository, "add", "feature-one.txt");
  git(repository, "commit", "--quiet", "-m", "feature one");
  const featureCommit = git(repository, "rev-parse", "HEAD");
  git(repository, "checkout", "--quiet", "main");
  git(repository, "merge", "--quiet", "--no-ff", "feature-one", "-m", "merge one");
  const targetMerge = git(repository, "rev-parse", "HEAD");
  const targetBase = git(repository, "rev-parse", "HEAD^1");

  git(repository, "checkout", "--quiet", "-b", "feature-two");
  await writeFile(join(repository, "feature-two.txt"), "two\n", "utf8");
  git(repository, "add", "feature-two.txt");
  git(repository, "commit", "--quiet", "-m", "feature two");
  git(repository, "checkout", "--quiet", "main");
  git(repository, "merge", "--quiet", "--no-ff", "feature-two", "-m", "merge two");
  const currentMain = git(repository, "rev-parse", "HEAD");
  git(repository, "update-ref", "refs/remotes/origin/main", currentMain);
  git(repository, "checkout", "--quiet", "--detach", targetMerge);
  return { repository, initialCommit, featureCommit, targetBase, targetMerge, currentMain };
}

function resolveTarget(history, overrides = {}) {
  return resolvePostMergeTarget({
    targetSha: history.targetMerge,
    currentMainSha: history.currentMain,
    refName: "main",
    repository: history.repository,
    ...overrides,
  });
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("exact protected-main post-merge target resolution", () => {
  test("derives the target first parent and exact scope bindings", async () => {
    const history = await makeHistory();
    expect(resolveTarget(history)).toEqual({
      PHASE1_SCOPE_BASE: history.targetBase,
      PHASE1_SCOPE_HEAD: history.targetMerge,
      PHASE1_SCOPE_BRANCH: "main",
      PHASE1_SCOPE_EVENT: "local",
      POST_MERGE_QUALIFICATION_TARGET: history.targetMerge,
      POST_MERGE_QUALIFICATION_CURRENT_MAIN: history.currentMain,
    });
  });

  test.each(["", "a".repeat(39), "A".repeat(40)])(
    "rejects malformed target SHA %j",
    async (targetSha) => {
      const history = await makeHistory();
      expect(() => resolveTarget(history, { targetSha })).toThrow("INVALID_POST_MERGE_TARGET_SHA");
    },
  );

  test("rejects dispatch from a non-main ref", async () => {
    const history = await makeHistory();
    expect(() => resolveTarget(history, { refName: "release" })).toThrow(
      "POST_MERGE_DISPATCH_REQUIRES_MAIN",
    );
  });

  test("rejects a checkout that differs from the exact target", async () => {
    const history = await makeHistory();
    git(history.repository, "checkout", "--quiet", "--detach", history.currentMain);
    expect(() => resolveTarget(history)).toThrow("POST_MERGE_TARGET_CHECKOUT_MISMATCH");
  });

  test("rejects a claimed current main that differs from origin/main", async () => {
    const history = await makeHistory();
    expect(() => resolveTarget(history, { currentMainSha: history.targetMerge })).toThrow(
      "POST_MERGE_CURRENT_MAIN_MISMATCH",
    );
  });

  test("rejects a target outside the protected-main first-parent chain", async () => {
    const history = await makeHistory();
    git(history.repository, "checkout", "--quiet", "--detach", history.featureCommit);
    expect(() => resolveTarget(history, { targetSha: history.featureCommit })).toThrow(
      "POST_MERGE_TARGET_OUTSIDE_MAIN_FIRST_PARENT",
    );
  });

  test("rejects a first-parent commit that is not a two-parent merge", async () => {
    const history = await makeHistory();
    git(history.repository, "checkout", "--quiet", "--detach", history.initialCommit);
    expect(() => resolveTarget(history, { targetSha: history.initialCommit })).toThrow(
      "POST_MERGE_TARGET_NOT_TWO_PARENT_MERGE",
    );
  });

  test("keeps one verify producer and removes the controller before qualification", async () => {
    const workflows = join(root, ".github/workflows");
    const m0 = await readFile(join(workflows, "m0-independent-verify.yml"), "utf8");
    const quality = await readFile(join(workflows, "quality.yml"), "utf8");
    const producers = [m0, quality].flatMap((source) => source.match(/^ {2}verify:\s*$/gm) ?? []);
    expect(producers).toHaveLength(1);
    for (const source of [m0, quality]) {
      expect(source).toContain("target_sha:");
      expect(source).toContain("resolve-post-merge-target.mjs");
      expect(source).toContain("POST_MERGE_CURRENT_MAIN_SHA: ${{ github.sha }}");
      expect(source).toContain("POST_MERGE_REF_NAME: ${{ github.ref_name }}");
    }
    expect(m0.indexOf("rm -rf ../controller")).toBeLessThan(
      m0.indexOf("node scripts/toolchain/verify-scope.mjs"),
    );
    expect(quality.indexOf('fs.rmSync(".post-merge-controller"')).toBeLessThan(
      quality.indexOf("pnpm run verify:scope"),
    );
  });
});
