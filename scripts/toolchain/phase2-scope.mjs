import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";

import { repositoryRoot } from "./lib.mjs";
import { isSafeRepositoryPath } from "./scope-policy.mjs";
import {
  PHASE2_CHECK,
  PHASE2_OPERATION,
  PHASE2_EXECUTION,
  PHASE2_OPERATION_PATH,
  PHASE2_SCOPE_PATH,
  P1_ACCEPTED_HEAD,
  P1_LANDING_HEAD,
  P1_RECEIPT_PATH,
  P1_HUMAN_PATH,
  lfHash,
  phase2PathAllowed,
  validateAcceptedP1,
  validatePhase2Declarations,
  validatePhase2RequiredScripts,
} from "./phase2-scope-policy.mjs";

export async function verifyPhase2Scope({
  branch,
  event = "local",
  eventBase,
  headCommit,
  explicitOperation,
  root = repositoryRoot,
}) {
  function git(...args) {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`P2_GIT_FAILURE: ${args.join(" ")} ${result.stderr}`);
    return result.stdout;
  }
  function paths(...args) {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      shell: false,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error("P2_GIT_PATH_ENUMERATION_FAILED");
    const raw = result.stdout;
    if (raw.length === 0) return [];
    if (raw.at(-1) !== 0) throw new Error("P2_NON_CANONICAL_PATH_OUTPUT");
    const values = new TextDecoder("utf-8", { fatal: true }).decode(raw).slice(0, -1).split("\0");
    if (values.some((path) => !isSafeRepositoryPath(path)))
      throw new Error("P2_NON_CANONICAL_PATH");
    return values;
  }
  function requireCondition(condition, code) {
    if (!condition) throw new Error(code);
  }
  const read = (path) => readFile(resolve(root, path), "utf8");
  const readJson = async (path) => JSON.parse(await read(path));
  const isO02 =
    branch === "phase-2/p2-o02-atomic-results" ||
    explicitOperation === "P2-O02" ||
    (eventBase &&
      !/^0{40}$/.test(eventBase) &&
      paths("diff", "--no-renames", "--name-only", "-z", eventBase, headCommit).includes(
        "operations/phase-2/executions/p2-o02-atomic-results.json",
      ));
  if (isO02) {
    const { verifyPhase2O02Scope } = await import("./phase2-scope-o02.mjs");
    return verifyPhase2O02Scope({ branch, event, eventBase, headCommit, explicitOperation, root });
  }
  requireCondition(["local", "push", "pull_request"].includes(event), "P2_UNKNOWN_EVENT");
  requireCondition(
    !explicitOperation || explicitOperation === PHASE2_OPERATION,
    "P2_UNKNOWN_OPERATION",
  );
  requireCondition(/^[0-9a-f]{40}$/.test(headCommit ?? ""), "P2_INVALID_HEAD");
  requireCondition(git("rev-parse", "HEAD").trim() === headCommit, "P2_HEAD_CHECKOUT_MISMATCH");
  git("check-ref-format", "--branch", branch);
  const operation = await readJson(PHASE2_OPERATION_PATH);
  const scope = await readJson(PHASE2_SCOPE_PATH);
  const execution = await readJson(PHASE2_EXECUTION);
  validatePhase2Declarations({ operation, scope, execution });
  const baseCommit = execution.baseCommit;
  git("cat-file", "-e", `${baseCommit}^{commit}`);
  git("merge-base", "--is-ancestor", baseCommit, headCommit);
  git("merge-base", "--is-ancestor", P1_ACCEPTED_HEAD, baseCommit);
  const p1Parents = git("rev-list", "--parents", "-n", "1", baseCommit).trim().split(" ");
  requireCondition(
    p1Parents.length === 3 && p1Parents[2] === P1_LANDING_HEAD,
    "P2_BASE_NOT_ACCEPTED_P1_MAIN_MERGE",
  );
  const receiptText = git("show", `${baseCommit}:${P1_RECEIPT_PATH}`);
  const receipt = JSON.parse(receiptText);
  requireCondition(
    isSafeRepositoryPath(receipt.independentVerificationRef),
    "P2_UNSAFE_INDEPENDENT_REFERENCE",
  );
  validateAcceptedP1({
    receiptText,
    independent: JSON.parse(git("show", `${baseCommit}:${receipt.independentVerificationRef}`)),
    human: JSON.parse(git("show", `${baseCommit}:${P1_HUMAN_PATH}`)),
  });
  const mode = branch === "main" ? "PHASE2_OPERATION_MERGE" : "PHASE2_OPERATION_EXECUTION";
  requireCondition(
    branch === "main" || branch === execution.implementationBranch,
    "P2_BRANCH_MISMATCH",
  );
  if (eventBase && !(event === "push" && branch !== "main" && /^0{40}$/.test(eventBase))) {
    requireCondition(/^[0-9a-f]{40}$/.test(eventBase), "P2_INVALID_EVENT_BASE");
    if (event === "push" && branch !== "main") {
      git("merge-base", "--is-ancestor", baseCommit, eventBase);
      git("merge-base", "--is-ancestor", eventBase, headCommit);
    } else requireCondition(eventBase === baseCommit, "P2_EVENT_BASE_MISMATCH");
  } else requireCondition(branch !== "main", "P2_MAIN_EVENT_BASE_REQUIRED");
  if (branch === "main") {
    const parents = git("rev-list", "--parents", "-n", "1", headCommit).trim().split(" ");
    requireCondition(
      parents.length === 3 && parents[1] === baseCommit,
      "P2_MAIN_MERGE_PARENT_MISMATCH",
    );
    requireCondition(
      git("rev-parse", `${parents[2]}^{tree}`).trim() ===
        git("rev-parse", `${headCommit}^{tree}`).trim(),
      "P2_MAIN_MERGE_TREE_MISMATCH",
    );
  }
  const changedPaths = [
    ...new Set([
      ...paths("diff", "--no-renames", "--name-only", "-z", baseCommit, headCommit),
      ...paths("diff", "--no-renames", "--name-only", "-z", headCommit),
      ...paths("ls-files", "--others", "--exclude-standard", "-z"),
    ]),
  ].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  requireCondition(changedPaths.includes(PHASE2_EXECUTION), "P2_EXECUTION_NOT_IN_CHANGESET");
  const violations = changedPaths.filter((path) => !phase2PathAllowed(path));
  requireCondition(violations.length === 0, `P2_OUT_OF_SCOPE: ${violations.join(",")}`);
  validatePhase2RequiredScripts(
    JSON.parse(git("show", `${baseCommit}:package.json`)),
    await readJson("package.json"),
  );
  const authority = JSON.parse(git("show", `${baseCommit}:operations/phase-1/authority-lock.json`));
  for (const entry of authority.authorityFiles) {
    requireCondition(
      lfHash(await read(entry.path)) === entry.sha256 &&
        lfHash(git("show", `${baseCommit}:${entry.path}`)) === entry.sha256,
      `P2_FROZEN_P1_AUTHORITY_CHANGED: ${entry.path}`,
    );
  }
  return {
    schemaVersion: "1.0.0",
    check: PHASE2_CHECK,
    result: "PASS",
    mode,
    operationId: PHASE2_OPERATION,
    executionRecord: PHASE2_EXECUTION,
    baseCommit,
    headCommit,
    branch,
    enforcementMode: "DENY_BY_DEFAULT",
    acceptedP1Head: P1_ACCEPTED_HEAD,
    acceptedP1MainCommit: baseCommit,
    p1HumanAcceptance: "PASS",
    authorityFilesVerified: authority.authorityFiles.length,
    changedPaths,
    violations: [],
    phase2Complete: false,
  };
}
