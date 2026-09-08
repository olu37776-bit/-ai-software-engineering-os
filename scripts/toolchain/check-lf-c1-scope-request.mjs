import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveOperationDefinition, validateOperationChangedPaths } from "./scope-policy.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const requestPath = "operations/phase-1/evidence/o01/lf-c1-entry-request.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function gitText(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function at(commit, path) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("EXACT_COMMIT_REQUIRED");
  return gitText(["show", `${commit}:${path}`]);
}

function exactPaths(paths) {
  if (!Array.isArray(paths) || paths.length === 0) throw new Error("EMPTY_PATH_SET");
  for (const path of paths) {
    if (
      typeof path !== "string" ||
      !/^[A-Za-z0-9_.@/-]+$/.test(path) ||
      path.startsWith("/") ||
      path.split("/").some((part) => ["", ".", ".."].includes(part))
    ) {
      throw new Error(`NON_EXACT_PATH: ${String(path)}`);
    }
  }
  if (new Set(paths).size !== paths.length) throw new Error("DUPLICATE_PATH");
  if (JSON.stringify([...paths].sort()) !== JSON.stringify(paths)) {
    throw new Error("UNSORTED_PATHS");
  }
}

export function checkRequestedPaths(request, paths) {
  if (
    request.recordType !== "LF_C1_ENTRY_REQUEST_NOT_AUTHORITY" ||
    request.status !== "BLOCKED" ||
    request.codeStartAuthorized !== false ||
    request.requestedOperation?.operationId !== "LF-C1" ||
    request.requestedOperation?.approvedMain !== null ||
    request.writeScope?.enforcementMode !== "DENY_BY_DEFAULT"
  ) {
    throw new Error("REQUEST_CANNOT_GRANT_AUTHORITY");
  }
  exactPaths(request.writeScope.allowedChangedPaths);
  exactPaths(paths);
  const allowed = new Set(request.writeScope.allowedChangedPaths);
  const outside = paths.filter((path) => !allowed.has(path));
  if (outside.length > 0) throw new Error(`OUTSIDE_REQUEST: ${outside.join(",")}`);
  return { requestedPaths: paths.length, authorityGranted: false };
}

export function inspectRequest(request, paths) {
  const range = checkRequestedPaths(request, paths);
  const { commit, path, sha256: expectedHash } = request.source;
  const sourceBytes = at(commit, path);
  if (sha256(sourceBytes) !== expectedHash) throw new Error("SOURCE_DOCUMENT_HASH_MISMATCH");
  const blocks = [...sourceBytes.matchAll(/```text\n([\s\S]*?)\n```/g)];
  const sourcePaths = blocks.flatMap((match) => match[1].split("\n"));
  const documentedPaths = [
    ...sourcePaths,
    "docs/architecture/learning-feedback/contract-and-seam-proposal.md",
    "docs/implementation/learning-feedback/lf-c1-implementation.md",
    "docs/roadmap/learning-feedback-branch-plan.md",
    "docs/roadmap/learning-feedback-core-entry-plan.md",
  ].sort();
  if (JSON.stringify(documentedPaths) !== JSON.stringify(request.writeScope.allowedChangedPaths)) {
    throw new Error("SCOPE_DIFFERS_FROM_FROZEN_ENTRY_DOCUMENT");
  }
  const steps = sourceBytes
    .split("\n")
    .filter((line) => /^\| C1-V\d\d \|/.test(line))
    .map((line) => {
      const cells = line.split("|");
      return { id: cells[1].trim(), requirement: cells[2].trim() };
    });
  if (
    steps.length !== 18 ||
    JSON.stringify(steps) !== JSON.stringify(request.verificationPlan.steps)
  ) {
    throw new Error("VERIFICATION_PLAN_DIFFERS_FROM_FROZEN_DOCUMENT");
  }
  const main = request.observedMain.commit;
  if (gitText(["rev-parse", `${main}^{tree}`]).trim() !== request.observedMain.tree) {
    throw new Error("MAIN_TREE_MISMATCH");
  }
  for (const [authorityPath, hash] of Object.entries(request.observedAuthoritySha256)) {
    if (sha256(at(main, authorityPath)) !== hash)
      throw new Error(`AUTHORITY_HASH_MISMATCH: ${authorityPath}`);
  }
  const manifest = JSON.parse(at(main, "operations/phase-1/operation.json"));
  const scope = JSON.parse(at(main, "operations/phase-1/write-scope.json"));
  const lock = JSON.parse(at(main, "operations/phase-1/authority-lock.json"));
  // These are diagnostics of the frozen existing dispatcher, never a new LF route.
  // Fail if the imported implementation no longer matches the pinned authority.
  if (
    sha256(readFileSync(resolve(root, "scripts/toolchain/scope-policy.mjs"))) !==
    request.observedAuthoritySha256["scripts/toolchain/scope-policy.mjs"]
  ) {
    throw new Error("LOCAL_SCOPE_POLICY_DIFFERS_FROM_PINNED_MAIN");
  }
  let dispatcherError = null;
  try {
    resolveOperationDefinition("LF-C1", manifest, scope);
  } catch (error) {
    dispatcherError = error.message;
  }
  const deniedAsP1O02 = validateOperationChangedPaths(
    ["packages/learning/src/index.ts"],
    "P1-O02",
    scope,
    lock,
  );
  return {
    schemaVersion: "1.0.0",
    recordType: "LF_C1_REQUEST_DIAGNOSTIC_NOT_ENTRY_EVIDENCE",
    decision: "BLOCKED",
    approvedMain: null,
    codeStartAuthorized: false,
    requestValidation: "PASS",
    scopeAuthorityMode: "REQUEST_RANGE_ONLY",
    requestSha256: sha256(JSON.stringify(request)),
    observedMain: request.observedMain,
    source: request.source,
    range,
    verificationSteps: steps.length,
    existingDispatcher: { operation: "LF-C1", error: dispatcherError },
    p1O02LearningDenial: deniedAsP1O02,
    actualEntryGate: "NOT_IMPLEMENTED_OR_AUTHORIZED_BY_THIS_DIAGNOSTIC",
    remainingGates: request.gates,
    limitation:
      "Checks a frozen request, not current GitHub approval/protection or live main; never issues READY.",
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 0 && !(args.length === 2 && args[0] === "--paths-json")) {
      throw new Error(
        "USAGE: node scripts/toolchain/check-lf-c1-scope-request.mjs [--paths-json file]",
      );
    }
    const request = JSON.parse(readFileSync(resolve(root, requestPath), "utf8"));
    const paths = args.length
      ? JSON.parse(readFileSync(args[1], "utf8"))
      : request.writeScope.allowedChangedPaths;
    console.log(JSON.stringify(inspectRequest(request, paths), null, 2));
    process.exitCode = 2;
  } catch (error) {
    console.error(
      JSON.stringify({ decision: "BLOCKED", codeStartAuthorized: false, error: error.message }),
    );
    process.exitCode = 2;
  }
}
