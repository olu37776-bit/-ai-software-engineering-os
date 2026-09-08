import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { TextDecoder } from "node:util";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./lib.mjs";
import { isSafeRepositoryPath } from "./scope-policy.mjs";
import {
  PHASE2_CHECK,
  P1_ACCEPTED_HEAD,
  P1_RECEIPT_PATH,
  P1_HUMAN_PATH,
  lfHash,
  validateAcceptedP1,
} from "./phase2-scope-policy.mjs";
import {
  P2_O02_ID,
  P2_O02_BRANCH,
  P2_O01_ACCEPTED_MAIN,
  P2_O02_OPERATION,
  P2_O02_SCOPE,
  P2_O02_EXECUTION,
  P2_O02_ADDITIVE_AUTHORITY,
  RESULT_SCHEMA_PATH,
  p2O02PathAllowed,
  validateP2O02Declarations,
  validateP2O02ContractDelta,
  validateP2O02RequiredScripts,
} from "./phase2-scope-o02-policy.mjs";

export async function verifyPhase2O02Scope({
  branch,
  event = "local",
  eventBase,
  headCommit,
  explicitOperation,
  root = repositoryRoot,
}) {
  function requireCondition(condition, message) {
    if (!condition) throw new Error(message);
  }
  function git(...args) {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      encoding: "utf8",
      shell: false,
    });
    if (result.error) throw result.error;
    requireCondition(result.status === 0, `P2_O02_GIT_FAILURE: ${args.join(" ")} ${result.stderr}`);
    return result.stdout;
  }
  function paths(...args) {
    const result = spawnSync("git", ["-c", "core.quotepath=false", ...args], {
      cwd: root,
      shell: false,
    });
    if (result.error) throw result.error;
    requireCondition(result.status === 0, "P2_O02_GIT_PATH_ENUMERATION_FAILED");
    if (result.stdout.length === 0) return [];
    requireCondition(result.stdout.at(-1) === 0, "P2_O02_UNTERMINATED_PATH_OUTPUT");
    const values = new TextDecoder("utf-8", { fatal: true })
      .decode(result.stdout)
      .slice(0, -1)
      .split("\0");
    requireCondition(values.every(isSafeRepositoryPath), "P2_O02_NON_CANONICAL_PATH");
    return values;
  }
  const read = (path) => readFile(resolve(root, path), "utf8");
  const json = async (path) => JSON.parse(await read(path));
  requireCondition(["local", "push", "pull_request"].includes(event), "P2_O02_UNKNOWN_EVENT");
  requireCondition(
    !explicitOperation || explicitOperation === P2_O02_ID,
    "P2_O02_UNKNOWN_OPERATION",
  );
  requireCondition(branch === P2_O02_BRANCH || branch === "main", "P2_O02_BRANCH_MISMATCH");
  requireCondition(/^[0-9a-f]{40}$/.test(headCommit ?? ""), "P2_O02_INVALID_HEAD");
  requireCondition(git("rev-parse", "HEAD").trim() === headCommit, "P2_O02_HEAD_CHECKOUT_MISMATCH");
  const operation = await json(P2_O02_OPERATION);
  const scope = await json(P2_O02_SCOPE);
  const execution = await json(P2_O02_EXECUTION);
  validateP2O02Declarations(operation, scope, execution);
  const baseCommit = P2_O01_ACCEPTED_MAIN;
  git("merge-base", "--is-ancestor", baseCommit, headCommit);
  git("merge-base", "--is-ancestor", P1_ACCEPTED_HEAD, baseCommit);
  const prior = JSON.parse(git("show", `${baseCommit}:operations/phase-2/operation.json`));
  const priorExecution = JSON.parse(
    git("show", `${baseCommit}:operations/phase-2/executions/p2-o01-durable-kernel.json`),
  );
  const priorParents = git("rev-list", "--parents", "-n", "1", baseCommit).trim().split(" ");
  requireCondition(
    prior.operationId === "P2-O01" &&
      prior.acceptedP1Head === P1_ACCEPTED_HEAD &&
      prior.acceptedP1MainCommit === priorExecution.baseCommit &&
      priorParents.length === 3 &&
      priorParents[1] === prior.acceptedP1MainCommit,
    "P2_O02_BASE_NOT_ACCEPTED_O01_MAIN",
  );
  const receiptText = git("show", `${baseCommit}:${P1_RECEIPT_PATH}`);
  const receipt = JSON.parse(receiptText);
  requireCondition(
    isSafeRepositoryPath(receipt.independentVerificationRef),
    "P2_O02_UNSAFE_P1_RECEIPT_REFERENCE",
  );
  validateAcceptedP1({
    receiptText,
    independent: JSON.parse(git("show", `${baseCommit}:${receipt.independentVerificationRef}`)),
    human: JSON.parse(git("show", `${baseCommit}:${P1_HUMAN_PATH}`)),
  });
  if (eventBase && !(event === "push" && branch !== "main" && /^0{40}$/.test(eventBase))) {
    requireCondition(/^[0-9a-f]{40}$/.test(eventBase), "P2_O02_INVALID_EVENT_BASE");
    if (event === "push" && branch !== "main") {
      git("merge-base", "--is-ancestor", baseCommit, eventBase);
      git("merge-base", "--is-ancestor", eventBase, headCommit);
    } else requireCondition(eventBase === baseCommit, "P2_O02_EVENT_BASE_MISMATCH");
  } else requireCondition(branch !== "main", "P2_O02_MAIN_BASE_REQUIRED");
  if (branch === "main") {
    const parents = git("rev-list", "--parents", "-n", "1", headCommit).trim().split(" ");
    requireCondition(
      parents.length === 3 && parents[1] === baseCommit,
      "P2_O02_MAIN_MERGE_PARENT_MISMATCH",
    );
    requireCondition(
      git("rev-parse", `${parents[2]}^{tree}`).trim() ===
        git("rev-parse", `${headCommit}^{tree}`).trim(),
      "P2_O02_MAIN_MERGE_TREE_MISMATCH",
    );
  }
  const changedPaths = [
    ...new Set([
      ...paths("diff", "--no-renames", "--name-only", "-z", baseCommit, headCommit),
      ...paths("diff", "--no-renames", "--name-only", "-z", headCommit),
      ...paths("ls-files", "--others", "--exclude-standard", "-z"),
    ]),
  ].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  requireCondition(changedPaths.includes(P2_O02_EXECUTION), "P2_O02_EXECUTION_NOT_IN_CHANGESET");
  const violations = changedPaths.filter((path) => !p2O02PathAllowed(path));
  requireCondition(violations.length === 0, `P2_O02_OUT_OF_SCOPE: ${violations.join(",")}`);
  const before = {};
  const after = {};
  for (const [key, path] of Object.entries({
    registry: "packages/contracts/schema-registry.json",
    inventory: "packages/contracts/schema-inventory.json",
    bindings: "packages/contracts/type-bindings.json",
    suite: "packages/contracts/examples/first-slice/example-suite.json",
  })) {
    before[key] = JSON.parse(git("show", `${baseCommit}:${path}`));
    after[key] = await json(path);
  }
  const additiveAuthority = validateP2O02ContractDelta({
    before,
    after,
    schemaText: await read(RESULT_SCHEMA_PATH),
  });
  const lockPath = "operations/phase-1/authority-lock.json";
  const lockText = git("show", `${baseCommit}:${lockPath}`);
  requireCondition(lfHash(await read(lockPath)) === lfHash(lockText), "P2_O02_P1_LOCK_CHANGED");
  const lock = JSON.parse(lockText);
  const validatedAuthorityHashes = {};
  for (const entry of lock.authorityFiles) {
    requireCondition(
      lfHash(git("show", `${baseCommit}:${entry.path}`)) === entry.sha256,
      `P2_O02_BASE_AUTHORITY_MISMATCH: ${entry.path}`,
    );
    const currentHash = lfHash(await read(entry.path));
    if (P2_O02_ADDITIVE_AUTHORITY.includes(entry.path)) {
      requireCondition(
        entry.mutationPolicy === "OPERATION_SCOPED",
        "P2_O02_IMMUTABLE_AUTHORITY_NOT_ADDITIVE",
      );
      validatedAuthorityHashes[entry.path] = currentHash;
    } else
      requireCondition(
        currentHash === entry.sha256,
        `P2_O02_FROZEN_AUTHORITY_CHANGED: ${entry.path}`,
      );
  }
  for (const entry of before.registry.schemas) {
    requireCondition(
      lfHash(await read(entry.authorityPath)) === entry.sha256,
      `P2_O02_EXISTING_SCHEMA_CHANGED: ${entry.authorityPath}`,
    );
  }
  const oldPackage = JSON.parse(git("show", `${baseCommit}:package.json`));
  const newPackage = await json("package.json");
  validateP2O02RequiredScripts(oldPackage, newPackage);
  const generation = spawnSync(
    process.execPath,
    ["scripts/contracts/generate-contract-types.mjs", "--check"],
    { cwd: root, encoding: "utf8", shell: false },
  );
  requireCondition(
    generation.status === 0,
    `P2_O02_GENERATED_TYPES_MISMATCH: ${generation.stderr}`,
  );
  return {
    schemaVersion: "1.0.0",
    check: PHASE2_CHECK,
    result: "PASS",
    mode: branch === "main" ? "PHASE2_OPERATION_MERGE" : "PHASE2_OPERATION_EXECUTION",
    operationId: P2_O02_ID,
    executionRecord: P2_O02_EXECUTION,
    baseCommit,
    headCommit,
    branch,
    enforcementMode: "DENY_BY_DEFAULT",
    acceptedP1Head: P1_ACCEPTED_HEAD,
    acceptedP1MainCommit: prior.acceptedP1MainCommit,
    acceptedO01MainCommit: baseCommit,
    p1HumanAcceptance: "PASS",
    authorityFilesVerified: lock.authorityFiles.length,
    additiveAuthority,
    validatedAuthorityHashes,
    changedPaths,
    violations: [],
    phase2Complete: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.slice(2).join(" ") !== "--authority-check")
      throw new Error("P2_O02_UNKNOWN_ARGUMENT");
    const head = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: false,
    });
    const report = await verifyPhase2O02Scope({
      branch: P2_O02_BRANCH,
      headCommit: head.stdout.trim(),
      explicitOperation: P2_O02_ID,
    });
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
