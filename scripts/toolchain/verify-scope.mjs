import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { TextDecoder } from "node:util";

import {
  AUTHORITY_LOCK_PATH,
  GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
  isSafeRepositoryPath,
  isPhase1GovernedPath,
  operationIdFromExecutionPath,
  P1_O02_START_GATE_PATH,
  P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
  P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
  P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
  P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT,
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
  P1_O04_REQUIRED_SCOPE_PATHS,
  P1_O04_START_GATE_PATH,
  P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT,
  P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
  P1_O05_REQUIRED_SCOPE_PATHS,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
  P1_O05_START_GATE_PATH,
  resolveOperationDefinition,
  selectEvidenceOperation,
  selectMergeExecutionRecord,
  selectGovernanceAmendmentAuthorizationGate,
  validateAuthorityLockHashes,
  validateAuthorityLockTransition,
  validateExecutionRecord,
  validateGovernanceAmendmentAuthorizationGate,
  validateGovernanceAmendmentChangedPaths,
  validateGovernanceAmendmentExecution,
  validateOperationAuthorityLockTransition,
  validateOperationChangedPaths,
  validateP1O02StartGate,
  validateP1O04StartGate,
  validateP1O05StartGate,
} from "./scope-policy.mjs";
import {
  readJson,
  reportAndExit,
  repositoryRoot,
  run,
  runRaw,
  sha256Utf8Lf,
  sha256Utf8LfFile,
} from "./lib.mjs";

const CHECK = "PHASE1_OPERATION_AWARE_WRITE_SCOPE";
const EXECUTION_DIRECTORY = "operations/phase-1/executions";
const GOVERNANCE_AMENDMENT_GATE_DIRECTORY = "operations/phase-1/evidence/o01";
const GOVERNANCE_AMENDMENT_GATE_FILE_PATTERN =
  /^p1-governance-amendment-authorization-issue-[1-9][0-9]*\.json$/;
const REPOSITORY = "olu37776-bit/-ai-software-engineering-os";

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!["--operation", "--base", "--head", "--branch", "--event"].includes(argument)) {
      throw new Error(`UNKNOWN_ARGUMENT: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`MISSING_ARGUMENT_VALUE: ${argument}`);
    }
    values[argument.slice(2)] = value;
    index += 1;
  }
  return values;
}

function gitOutput(args) {
  return run("git", ["-c", "core.quotepath=false", ...args]);
}

function assertCommit(commit, label) {
  if (!/^[0-9a-f]{40}$/.test(commit ?? "")) {
    throw new Error(`INVALID_${label}: ${commit || "<missing>"}`);
  }
  gitOutput(["cat-file", "-e", `${commit}^{commit}`]);
}

function assertAncestor(baseCommit, headCommit) {
  run("git", ["merge-base", "--is-ancestor", baseCommit, headCommit]);
}

function compareCanonicalPaths(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function gitPaths(args, label) {
  const raw = runRaw("git", ["-c", "core.quotepath=false", ...args], { encoding: null });
  if (!Buffer.isBuffer(raw)) {
    throw new Error(`INVALID_GIT_PATH_OUTPUT: ${label}`);
  }
  if (raw.length === 0) {
    return [];
  }
  if (raw.at(-1) !== 0) {
    throw new Error(`UNTERMINATED_GIT_PATH_OUTPUT: ${label}`);
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const paths = [];
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== 0) {
      continue;
    }
    const bytes = raw.subarray(start, index);
    start = index + 1;
    let path;
    try {
      path = decoder.decode(bytes);
    } catch {
      throw new Error(`NON_UTF8_GIT_PATH: ${label}`);
    }
    if (!isSafeRepositoryPath(path)) {
      throw new Error(`NON_CANONICAL_GIT_PATH: ${JSON.stringify(path)}`);
    }
    paths.push(path);
  }
  if (new Set(paths).size !== paths.length) {
    throw new Error(`DUPLICATE_GIT_PATH: ${label}`);
  }
  return paths;
}

function changedPathsFrom(baseCommit, headCommit) {
  const tracked = gitPaths(
    ["diff", "--no-renames", "--name-only", "-z", baseCommit, headCommit],
    "COMMITTED_DIFF",
  );
  const worktree = gitPaths(
    ["diff", "--no-renames", "--name-only", "-z", headCommit],
    "WORKTREE_DIFF",
  );
  const untracked = gitPaths(
    ["ls-files", "--others", "--exclude-standard", "-z"],
    "UNTRACKED_FILES",
  );
  return [...new Set([...tracked, ...worktree, ...untracked])].sort(compareCanonicalPaths);
}

async function loadExecutionRecords(operationManifest, writeScope) {
  const directory = resolve(repositoryRoot, EXECUTION_DIRECTORY);
  const entries = await readdir(directory, { withFileTypes: true });
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^p1-o0[1-9]-[^/]+\.json$/.test(entry.name)) {
      continue;
    }
    const path = `${EXECUTION_DIRECTORY}/${entry.name}`;
    const execution = JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
    validateExecutionRecord(path, execution, operationManifest, writeScope);
    records.push({ path, execution });
  }
  return records;
}

async function verifyImmutableAuthority(authorityLock) {
  const failures = [];
  let verified = 0;
  for (const entry of authorityLock.authorityFiles) {
    if (entry.mutationPolicy !== "IMMUTABLE") {
      continue;
    }
    try {
      const actual = await sha256Utf8LfFile(entry.path);
      if (actual !== entry.sha256) {
        failures.push(`AUTHORITY_HASH_MISMATCH: ${entry.path}`);
      } else {
        verified += 1;
      }
    } catch {
      failures.push(`AUTHORITY_FILE_MISSING: ${entry.path}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return verified;
}

function readJsonAtCommit(commit, path) {
  return JSON.parse(gitFileAtCommit(commit, path));
}

function gitFileAtCommit(commit, path) {
  return runRaw("git", ["-c", "core.quotepath=false", "show", `${commit}:${path}`]);
}

function loadGovernanceAmendmentGatesFromBase(baseCommit) {
  let paths;
  try {
    paths = gitOutput([
      "ls-tree",
      "-r",
      "--name-only",
      baseCommit,
      GOVERNANCE_AMENDMENT_GATE_DIRECTORY,
    ])
      .split(/\r?\n/)
      .filter((path) => GOVERNANCE_AMENDMENT_GATE_FILE_PATTERN.test(path.split("/").at(-1) ?? ""));
  } catch {
    throw new Error("FAILED_TO_ENUMERATE_PRIOR_GOVERNANCE_AMENDMENT_GATES");
  }

  return paths.map((path) => {
    let gate;
    try {
      gate = readJsonAtCommit(baseCommit, path);
    } catch {
      throw new Error(`MALFORMED_PRIOR_GOVERNANCE_AMENDMENT_GATE: ${path}`);
    }
    return { path, gate };
  });
}

async function verifyCompleteAuthorityLock(authorityLock) {
  const actualHashes = new Map();
  for (const entry of authorityLock.authorityFiles) {
    try {
      actualHashes.set(entry.path, await sha256Utf8LfFile(entry.path));
    } catch {
      // The policy validator reports the missing path with a stable failure code.
    }
  }
  const failures = validateAuthorityLockHashes(authorityLock, actualHashes);
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return actualHashes.size;
}

async function verifyUnrelatedAuthorityBytes(baseCommit, baseLock, allowedChangedPaths) {
  const allowed = new Set(allowedChangedPaths);
  const failures = [];
  let verified = 0;
  for (const entry of baseLock.authorityFiles) {
    if (allowed.has(entry.path)) {
      continue;
    }
    try {
      const baseHash = sha256Utf8Lf(gitFileAtCommit(baseCommit, entry.path));
      const headHash = await sha256Utf8LfFile(entry.path);
      if (baseHash !== headHash) {
        failures.push(`UNRELATED_AUTHORITY_MUTATION: ${entry.path}`);
      } else {
        verified += 1;
      }
    } catch {
      failures.push(`UNRELATED_AUTHORITY_MISSING: ${entry.path}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
  return verified;
}

function validateEventBase(event, branch, eventBase, executionBase, headCommit) {
  if (!eventBase) {
    return;
  }
  if (event === "push" && branch !== "main" && /^0{40}$/.test(eventBase)) {
    return;
  }
  assertCommit(eventBase, "EVENT_BASE");
  assertAncestor(eventBase, headCommit);
  if (event === "pull_request" || (event === "push" && branch === "main")) {
    if (eventBase !== executionBase) {
      throw new Error(`MISMATCHED_AUTHORIZED_BASE: event=${eventBase} execution=${executionBase}`);
    }
  } else if (event === "push") {
    assertAncestor(executionBase, eventBase);
  } else if (event === "local" && eventBase !== executionBase) {
    throw new Error(`MISMATCHED_AUTHORIZED_BASE: explicit=${eventBase} execution=${executionBase}`);
  }
}

function loadStartGate(baseCommit, path, blockedCode) {
  try {
    return JSON.parse(gitOutput(["show", `${baseCommit}:${path}`]));
  } catch {
    throw new Error(`${blockedCode}: ${path} is absent from authorized base ${baseCommit}`);
  }
}

function assertExactTree(commit, expectedTree, label) {
  const actualTree = gitOutput(["rev-parse", `${commit}^{tree}`]);
  if (actualTree !== expectedTree) {
    throw new Error(`MISMATCHED_${label}_TREE: expected=${expectedTree} actual=${actualTree}`);
  }
}

function exactMergeParents(commit, label) {
  const fields = gitOutput(["rev-list", "--parents", "-n", "1", commit]).split(" ");
  if (fields.length !== 3 || fields[0] !== commit) {
    throw new Error(`MISMATCHED_${label}_MERGE_PARENTS`);
  }
  return { firstParent: fields[1], secondParent: fields[2] };
}

function assertExactMergeParents(commit, firstParent, secondParent, label) {
  const actual = exactMergeParents(commit, label);
  if (actual.firstParent !== firstParent || actual.secondParent !== secondParent) {
    throw new Error(`MISMATCHED_${label}_MERGE_PARENTS`);
  }
}

function assertMergeSecondParent(commit, secondParent, label) {
  const actual = exactMergeParents(commit, label);
  if (actual.secondParent !== secondParent) {
    throw new Error(`MISMATCHED_${label}_MERGE_PARENTS`);
  }
  return actual.firstParent;
}

function verifyP1O04FinalAmendmentOutcome(commits, gate, baseCommit) {
  const finalMain = commits.finalAmendmentMainCommit;
  let execution;
  let evidence;
  let finalScope;
  let finalLock;
  try {
    execution = readJsonAtCommit(finalMain, P1_O04_FINAL_AMENDMENT_EXECUTION_PATH);
    evidence = readJsonAtCommit(finalMain, P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH);
    finalScope = readJsonAtCommit(finalMain, "operations/phase-1/write-scope.json");
    finalLock = readJsonAtCommit(finalMain, AUTHORITY_LOCK_PATH);
  } catch {
    throw new Error("P1_O04_FINAL_AMENDMENT_EVIDENCE_MISSING_OR_MALFORMED");
  }

  const finalBranch =
    `governance/p1-o04-final-scope-authority-amendment-issue-` +
    commits.finalAmendmentTrackingIssue;
  const authorizationGatePath =
    `operations/phase-1/evidence/o01/` +
    `p1-governance-amendment-authorization-issue-${commits.finalAmendmentTrackingIssue}.json`;
  let authorizationGate;
  try {
    authorizationGate = readJsonAtCommit(
      commits.finalAmendmentAuthorizationGateMainCommit,
      authorizationGatePath,
    );
  } catch {
    throw new Error("P1_O04_FINAL_AMENDMENT_AUTHORIZATION_GATE_MISSING_OR_MALFORMED");
  }
  const finalAmendmentAuthorizationGateBaseCommit = assertMergeSecondParent(
    commits.finalAmendmentAuthorizationGateMainCommit,
    commits.finalAmendmentAuthorizationGateReviewedHeadCommit,
    "FINAL_AMENDMENT_AUTHORIZATION_GATE",
  );
  assertAncestor(
    commits.transitionEnforcementMainCommit,
    finalAmendmentAuthorizationGateBaseCommit,
  );
  const authorizationRequest = {
    trackingIssue: commits.finalAmendmentTrackingIssue,
    implementationBranch: finalBranch,
    baseCommit: commits.finalAmendmentAuthorizationGateMainCommit,
    gatePath: authorizationGatePath,
  };
  const authorization = validateGovernanceAmendmentAuthorizationGate(authorizationGate, {
    request: authorizationRequest,
    repository: REPOSITORY,
    baseCommit: commits.finalAmendmentAuthorizationGateMainCommit,
    baseParentCommit: finalAmendmentAuthorizationGateBaseCommit,
  });
  if (
    JSON.stringify(authorization.allowedChangedPaths) !==
      JSON.stringify(P1_O04_FINAL_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(authorization.exactAmendmentPaths) !==
      JSON.stringify(P1_O04_FINAL_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(authorization.authorityOwnershipDeltas) !==
      JSON.stringify(P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS)
  ) {
    throw new Error("P1_O04_FINAL_AMENDMENT_AUTHORIZATION_GATE_MISMATCH");
  }
  const finalAmendmentChangedPaths = gitPaths(
    [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      commits.finalAmendmentAuthorizationGateMainCommit,
      commits.finalAmendmentReviewedHeadCommit,
    ],
    "P1_O04_FINAL_AMENDMENT_DIFF",
  );
  if (
    JSON.stringify(finalAmendmentChangedPaths) !==
    JSON.stringify(P1_O04_FINAL_AMENDMENT_CHANGED_PATHS)
  ) {
    throw new Error("P1_O04_FINAL_AMENDMENT_CHANGED_PATHS_MISMATCH");
  }
  if (
    execution?.schemaVersion !== "1.0.0" ||
    execution?.executionType !== "PHASE_1_GOVERNANCE_AMENDMENT" ||
    execution?.operationId !== "P1-O01" ||
    execution?.writeScopeOperationId !== "P1-O01" ||
    execution?.status !== "IMPLEMENTED" ||
    execution?.trackingIssue !== commits.finalAmendmentTrackingIssue ||
    execution?.implementationBranch !== finalBranch ||
    execution?.baseCommit !== commits.finalAmendmentAuthorizationGateMainCommit ||
    execution?.implementationCommit !== commits.finalAmendmentImplementationCommit ||
    execution?.implementationTree !== commits.finalAmendmentImplementationTree ||
    execution?.priorAuthorizationGateRef !== authorizationGatePath ||
    evidence?.schemaVersion !== "1.0.0" ||
    evidence?.evidenceType !== "P1O04FinalScopeAuthorityAmendmentEvidence" ||
    evidence?.decision !== "IMPLEMENTED" ||
    evidence?.operationId !== "P1-O01" ||
    evidence?.trackingIssue !== commits.finalAmendmentTrackingIssue ||
    evidence?.subject?.implementationCommit !== commits.finalAmendmentImplementationCommit ||
    evidence?.subject?.implementationTree !== commits.finalAmendmentImplementationTree ||
    JSON.stringify(evidence?.governanceOutcome?.requiredScopePaths) !==
      JSON.stringify(P1_O04_REQUIRED_SCOPE_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.authorityOwnershipPaths) !==
      JSON.stringify(P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.exactChangedPaths) !==
      JSON.stringify(P1_O04_FINAL_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.authorityOwnershipDeltas) !==
      JSON.stringify(P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS) ||
    evidence?.claimBoundary?.p1O04Implemented !== false ||
    evidence?.claimBoundary?.acceptedAdrChanged !== false
  ) {
    throw new Error("P1_O04_FINAL_AMENDMENT_EVIDENCE_MISMATCH");
  }

  const operationScope = finalScope?.operations?.find(
    ({ operationId }) => operationId === "P1-O04",
  );
  if (
    finalScope?.enforcementMode !== "DENY_BY_DEFAULT" ||
    !operationScope ||
    P1_O04_REQUIRED_SCOPE_PATHS.some((path) => !operationScope.allowedPathGlobs.includes(path))
  ) {
    throw new Error("P1_O04_FINAL_SCOPE_OUTCOME_MISMATCH");
  }
  const authorityByPath = new Map(
    (finalLock?.authorityFiles ?? []).map((entry) => [entry.path, entry]),
  );
  for (const path of P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS) {
    const entry = authorityByPath.get(path);
    if (
      entry?.mutationPolicy !== "OPERATION_SCOPED" ||
      JSON.stringify(entry.allowedOperationIds) !== JSON.stringify(["P1-O02", "P1-O04"])
    ) {
      throw new Error(`P1_O04_FINAL_AUTHORITY_OWNERSHIP_MISMATCH: ${path}`);
    }
  }
  assertAncestor(finalMain, baseCommit);
  return {
    finalAmendmentExecutionPath: P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
    finalAmendmentEvidencePath: P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
    requiredScopePathsVerified: P1_O04_REQUIRED_SCOPE_PATHS.length,
    authorityOwnershipPathsVerified: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.length,
    postMergeChecks: gate.verification.finalAmendmentPostMergeChecks,
  };
}

function verifyP1O05ScopeAuthorityAmendmentOutcome(commits, gate, baseCommit) {
  const authorizationGatePath =
    "operations/phase-1/evidence/o01/p1-governance-amendment-authorization-issue-53.json";
  let authorizationGate;
  let execution;
  let evidence;
  let amendmentScope;
  let amendmentLock;
  try {
    authorizationGate = readJsonAtCommit(
      commits.scopeAuthorizationGateMainCommit,
      authorizationGatePath,
    );
    execution = readJsonAtCommit(
      commits.scopeAuthorityAmendmentMainCommit,
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
    );
    evidence = readJsonAtCommit(
      commits.scopeAuthorityAmendmentMainCommit,
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
    );
    amendmentScope = readJsonAtCommit(
      commits.scopeAuthorityAmendmentMainCommit,
      "operations/phase-1/write-scope.json",
    );
    amendmentLock = readJsonAtCommit(
      commits.scopeAuthorityAmendmentMainCommit,
      AUTHORITY_LOCK_PATH,
    );
  } catch {
    throw new Error("P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_MISSING_OR_MALFORMED");
  }
  const authorizationBaseCommit = assertMergeSecondParent(
    commits.scopeAuthorizationGateMainCommit,
    commits.scopeAuthorizationGateReviewedHeadCommit,
    "P1_O05_AUTHORIZATION_GATE",
  );
  const authorization = validateGovernanceAmendmentAuthorizationGate(authorizationGate, {
    request: {
      trackingIssue: 53,
      implementationBranch: "governance/p1-o05-scope-authority-amendment-issue-53",
      baseCommit: commits.scopeAuthorizationGateMainCommit,
      gatePath: authorizationGatePath,
    },
    repository: REPOSITORY,
    baseCommit: commits.scopeAuthorizationGateMainCommit,
    baseParentCommit: authorizationBaseCommit,
  });
  if (
    JSON.stringify(authorization.allowedChangedPaths) !==
      JSON.stringify(P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(authorization.exactAmendmentPaths) !==
      JSON.stringify(P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(authorization.authorityOwnershipDeltas) !==
      JSON.stringify(P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS)
  ) {
    throw new Error("P1_O05_SCOPE_AUTHORITY_AMENDMENT_AUTHORIZATION_MISMATCH");
  }
  const changedPaths = gitPaths(
    [
      "diff",
      "--no-renames",
      "--name-only",
      "-z",
      commits.scopeAuthorizationGateMainCommit,
      commits.scopeAuthorityAmendmentReviewedHeadCommit,
    ],
    "P1_O05_SCOPE_AUTHORITY_AMENDMENT_DIFF",
  );
  if (
    JSON.stringify(changedPaths) !== JSON.stringify(P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS)
  ) {
    throw new Error("P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS_MISMATCH");
  }
  if (
    execution?.schemaVersion !== "1.0.0" ||
    execution?.executionType !== "PHASE_1_GOVERNANCE_AMENDMENT" ||
    execution?.operationId !== "P1-O01" ||
    execution?.writeScopeOperationId !== "P1-O01" ||
    execution?.status !== "IMPLEMENTED" ||
    execution?.trackingIssue !== 53 ||
    execution?.implementationBranch !== "governance/p1-o05-scope-authority-amendment-issue-53" ||
    execution?.baseCommit !== commits.scopeAuthorizationGateMainCommit ||
    execution?.implementationCommit !== commits.scopeAuthorityAmendmentImplementationCommit ||
    execution?.implementationTree !== commits.scopeAuthorityAmendmentImplementationTree ||
    execution?.priorAuthorizationGateRef !== authorizationGatePath ||
    evidence?.schemaVersion !== "1.0.0" ||
    evidence?.evidenceType !== "P1O05ScopeAuthorityAmendmentEvidence" ||
    evidence?.decision !== "IMPLEMENTED" ||
    evidence?.operationId !== "P1-O01" ||
    evidence?.trackingIssue !== 53 ||
    evidence?.subject?.implementationCommit !==
      commits.scopeAuthorityAmendmentImplementationCommit ||
    evidence?.subject?.implementationTree !== commits.scopeAuthorityAmendmentImplementationTree ||
    JSON.stringify(evidence?.governanceOutcome?.requiredScopePaths) !==
      JSON.stringify(P1_O05_REQUIRED_SCOPE_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.authorityOwnershipPaths) !==
      JSON.stringify(P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.exactChangedPaths) !==
      JSON.stringify(P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS) ||
    JSON.stringify(evidence?.governanceOutcome?.authorityOwnershipDeltas) !==
      JSON.stringify(P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS) ||
    evidence?.claimBoundary?.p1O05Implemented !== false ||
    evidence?.claimBoundary?.acceptedAdrChanged !== false
  ) {
    throw new Error("P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_MISMATCH");
  }
  const operationScope = amendmentScope?.operations?.find(
    ({ operationId }) => operationId === "P1-O05",
  );
  if (
    amendmentScope?.enforcementMode !== "DENY_BY_DEFAULT" ||
    !operationScope ||
    P1_O05_REQUIRED_SCOPE_PATHS.some((path) => !operationScope.allowedPathGlobs.includes(path))
  ) {
    throw new Error("P1_O05_SCOPE_AUTHORITY_AMENDMENT_OUTCOME_MISMATCH");
  }
  const authorityByPath = new Map(
    (amendmentLock?.authorityFiles ?? []).map((entry) => [entry.path, entry]),
  );
  for (const path of P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS) {
    const entry = authorityByPath.get(path);
    if (
      entry?.mutationPolicy !== "OPERATION_SCOPED" ||
      JSON.stringify(entry.allowedOperationIds) !== JSON.stringify(["P1-O02", "P1-O04", "P1-O05"])
    ) {
      throw new Error(`P1_O05_SCOPE_AUTHORITY_OWNERSHIP_MISMATCH: ${path}`);
    }
  }
  assertAncestor(commits.scopeAuthorityAmendmentMainCommit, baseCommit);
  return {
    requiredScopePathsVerified: P1_O05_REQUIRED_SCOPE_PATHS.length,
    authorityOwnershipPathsVerified: P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.length,
    postMergeChecks: gate.verification.scopeAuthorityAmendmentPostMergeChecks,
  };
}

function verifyOperationStartGate(operationId, baseCommit) {
  if (operationId !== "P1-O02" && operationId !== "P1-O04" && operationId !== "P1-O05") {
    return { required: false };
  }
  if (operationId === "P1-O02") {
    const gate = loadStartGate(baseCommit, P1_O02_START_GATE_PATH, "P1_O02_START_BLOCKED");
    const remediationImplementationCommit = validateP1O02StartGate(gate);
    assertCommit(remediationImplementationCommit, "REMEDIATION_IMPLEMENTATION_COMMIT");
    assertAncestor(remediationImplementationCommit, baseCommit);
    return {
      required: true,
      path: P1_O02_START_GATE_PATH,
      decision: gate.decision,
      p1O02Start: gate.authorization.p1O02Start,
      remediationImplementationCommit,
    };
  }
  if (operationId === "P1-O04") {
    const gate = loadStartGate(baseCommit, P1_O04_START_GATE_PATH, "P1_O04_START_BLOCKED");
    const commits = validateP1O04StartGate(gate);
    const commitEntries = Object.entries(commits).filter(([label]) => label.endsWith("Commit"));
    for (const [label, commit] of commitEntries) {
      assertCommit(
        commit,
        label.replaceAll(/(?<!^)[A-Z]/g, (letter) => `_${letter}`).toUpperCase(),
      );
    }
    if (
      commits.preliminaryScopeAmendmentMainCommit !== P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT
    ) {
      throw new Error("P1_O04_PRELIMINARY_SCOPE_AMENDMENT_IDENTITY_MISMATCH");
    }
    assertExactTree(
      commits.transitionEnforcementImplementationCommit,
      commits.transitionEnforcementImplementationTree,
      "TRANSITION_ENFORCEMENT_IMPLEMENTATION",
    );
    assertAncestor(
      commits.transitionEnforcementImplementationCommit,
      commits.transitionEnforcementReviewedHeadCommit,
    );
    assertExactMergeParents(
      commits.transitionEnforcementMainCommit,
      commits.preliminaryScopeAmendmentMainCommit,
      commits.transitionEnforcementReviewedHeadCommit,
      "TRANSITION_ENFORCEMENT",
    );
    const finalAmendmentAuthorizationGateBaseCommit = assertMergeSecondParent(
      commits.finalAmendmentAuthorizationGateMainCommit,
      commits.finalAmendmentAuthorizationGateReviewedHeadCommit,
      "FINAL_AMENDMENT_AUTHORIZATION_GATE",
    );
    assertAncestor(
      commits.transitionEnforcementMainCommit,
      finalAmendmentAuthorizationGateBaseCommit,
    );
    assertExactTree(
      commits.finalAmendmentImplementationCommit,
      commits.finalAmendmentImplementationTree,
      "FINAL_AMENDMENT_IMPLEMENTATION",
    );
    assertAncestor(
      commits.finalAmendmentAuthorizationGateMainCommit,
      commits.finalAmendmentImplementationCommit,
    );
    assertAncestor(
      commits.finalAmendmentImplementationCommit,
      commits.finalAmendmentReviewedHeadCommit,
    );
    assertExactMergeParents(
      commits.finalAmendmentMainCommit,
      commits.finalAmendmentAuthorizationGateMainCommit,
      commits.finalAmendmentReviewedHeadCommit,
      "FINAL_AMENDMENT",
    );
    const finalAmendmentOutcome = verifyP1O04FinalAmendmentOutcome(commits, gate, baseCommit);
    return {
      required: true,
      path: P1_O04_START_GATE_PATH,
      decision: gate.decision,
      p1O04Start: gate.authorization.p1O04Start,
      ...commits,
      finalAmendmentOutcome,
    };
  }

  const gate = loadStartGate(baseCommit, P1_O05_START_GATE_PATH, "P1_O05_START_BLOCKED");
  const commits = validateP1O05StartGate(gate);
  for (const [label, commit] of Object.entries(commits).filter(([key]) => key.endsWith("Commit"))) {
    assertCommit(commit, label.replaceAll(/(?<!^)[A-Z]/g, (letter) => `_${letter}`).toUpperCase());
  }
  assertExactTree(
    commits.scopeAuthorityAmendmentImplementationCommit,
    commits.scopeAuthorityAmendmentImplementationTree,
    "P1_O05_SCOPE_AUTHORITY_AMENDMENT_IMPLEMENTATION",
  );
  assertAncestor(
    commits.scopeAuthorizationGateMainCommit,
    commits.scopeAuthorityAmendmentImplementationCommit,
  );
  assertAncestor(
    commits.scopeAuthorityAmendmentImplementationCommit,
    commits.scopeAuthorityAmendmentReviewedHeadCommit,
  );
  assertExactMergeParents(
    commits.scopeAuthorityAmendmentMainCommit,
    commits.scopeAuthorizationGateMainCommit,
    commits.scopeAuthorityAmendmentReviewedHeadCommit,
    "P1_O05_SCOPE_AUTHORITY_AMENDMENT",
  );
  assertExactTree(
    commits.transitionEnforcementImplementationCommit,
    commits.transitionEnforcementImplementationTree,
    "P1_O05_TRANSITION_ENFORCEMENT_IMPLEMENTATION",
  );
  assertAncestor(
    commits.transitionEnforcementImplementationCommit,
    commits.transitionEnforcementReviewedHeadCommit,
  );
  assertExactMergeParents(
    commits.transitionEnforcementMainCommit,
    commits.scopeAuthorityAmendmentMainCommit,
    commits.transitionEnforcementReviewedHeadCommit,
    "P1_O05_TRANSITION_ENFORCEMENT",
  );
  assertAncestor(commits.transitionEnforcementMainCommit, baseCommit);
  const scopeAuthorityAmendmentOutcome = verifyP1O05ScopeAuthorityAmendmentOutcome(
    commits,
    gate,
    baseCommit,
  );
  return {
    required: true,
    path: P1_O05_START_GATE_PATH,
    decision: gate.decision,
    p1O05Start: gate.authorization.p1O05Start,
    ...commits,
    scopeAuthorityAmendmentOutcome,
  };
}

async function verifyOperationAuthorityTransition(
  baseCommit,
  authorityLock,
  operationId,
  changedPaths,
) {
  let baseLock;
  try {
    baseLock = readJsonAtCommit(baseCommit, AUTHORITY_LOCK_PATH);
  } catch {
    throw new Error("MALFORMED_BASE_AUTHORITY_LOCK");
  }
  const actualHashes = new Map();
  for (const entry of baseLock.authorityFiles ?? []) {
    if (!changedPaths.includes(entry.path)) {
      continue;
    }
    try {
      actualHashes.set(entry.path, await sha256Utf8LfFile(entry.path));
    } catch {
      // The transition validator reports the missing changed asset.
    }
  }
  const violations = validateOperationAuthorityLockTransition(
    baseLock,
    authorityLock,
    operationId,
    changedPaths,
    actualHashes,
  );
  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }
  return {
    lockChanged: changedPaths.includes(AUTHORITY_LOCK_PATH),
    changedLockedPaths: [...actualHashes.keys()].sort(),
  };
}

async function verifyGovernanceAmendment({
  record,
  event,
  branch,
  eventBase,
  headCommit,
  authorityLock,
  writeScope,
}) {
  const request = validateGovernanceAmendmentExecution(record.execution);
  if (!request) {
    throw new Error("INVALID_GOVERNANCE_AMENDMENT_EXECUTION_TYPE");
  }
  const baseCommit = request.baseCommit;
  assertCommit(baseCommit, "EXECUTION_BASE");
  assertAncestor(baseCommit, headCommit);
  validateEventBase(event, branch, eventBase, baseCommit, headCommit);
  if (event !== "push" || branch !== "main") {
    if (branch !== request.implementationBranch) {
      throw new Error(
        `MISMATCHED_GOVERNANCE_AMENDMENT_BRANCH: event=${branch || "<missing>"} authorization=${request.implementationBranch}`,
      );
    }
  }

  let baseParentCommit;
  try {
    baseParentCommit = gitOutput(["rev-parse", `${baseCommit}^1`]);
  } catch {
    throw new Error(`GOVERNANCE_AMENDMENT_BASE_HAS_NO_PARENT: ${baseCommit}`);
  }
  const candidates = loadGovernanceAmendmentGatesFromBase(baseCommit);
  const gate = selectGovernanceAmendmentAuthorizationGate(candidates, request);
  const { allowedChangedPaths, exactAmendmentPaths, authorityOwnershipDeltas } =
    validateGovernanceAmendmentAuthorizationGate(gate, {
      request,
      repository: REPOSITORY,
      baseCommit,
      baseParentCommit,
    });

  try {
    gitOutput(["cat-file", "-e", `${baseParentCommit}:${request.gatePath}`]);
    throw new Error(`GOVERNANCE_AMENDMENT_GATE_NOT_PRIOR: ${request.gatePath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GOVERNANCE_AMENDMENT_GATE_NOT_PRIOR")) {
      throw error;
    }
  }

  const changedPaths = changedPathsFrom(baseCommit, headCommit);
  const violations = validateGovernanceAmendmentChangedPaths(
    changedPaths,
    allowedChangedPaths,
    exactAmendmentPaths,
  );
  if (violations.length > 0) {
    throw new Error(violations.join("\n"));
  }

  let baseLock;
  try {
    baseLock = readJsonAtCommit(baseCommit, "operations/phase-1/authority-lock.json");
  } catch {
    throw new Error("MALFORMED_BASE_AUTHORITY_LOCK");
  }
  const transitionViolations = validateAuthorityLockTransition(
    baseLock,
    authorityLock,
    allowedChangedPaths,
    authorityOwnershipDeltas,
  );
  if (transitionViolations.length > 0) {
    throw new Error(transitionViolations.join("\n"));
  }
  const unrelatedAuthorityFilesVerified = await verifyUnrelatedAuthorityBytes(
    baseCommit,
    baseLock,
    allowedChangedPaths,
  );
  const authorityFilesVerified = await verifyCompleteAuthorityLock(authorityLock);

  reportAndExit({
    schemaVersion: "1.0.0",
    check: CHECK,
    result: "PASS",
    mode: "GOVERNANCE_AMENDMENT",
    operationId: record.execution.operationId,
    executionRecord: record.path,
    trackingIssue: request.trackingIssue,
    authorizationGate: request.gatePath,
    authorizationGateEvidenceType: GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
    authorizationBase: baseParentCommit,
    baseCommit,
    headCommit,
    branch,
    enforcementMode: writeScope.enforcementMode,
    authorityFilesVerified,
    unrelatedAuthorityFilesVerified,
    allowedChangedPaths,
    exactAmendmentPaths: exactAmendmentPaths ?? null,
    authorityOwnershipDeltas,
    changedPaths,
    violations: [],
  });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const operationManifest = await readJson("operations/phase-1/operation.json");
  const writeScope = await readJson("operations/phase-1/write-scope.json");
  const authorityLock = await readJson("operations/phase-1/authority-lock.json");
  if (writeScope.enforcementMode !== "DENY_BY_DEFAULT") {
    throw new Error(`INVALID_ENFORCEMENT_MODE: ${writeScope.enforcementMode}`);
  }
  const records = await loadExecutionRecords(operationManifest, writeScope);

  const event = args.event ?? process.env.PHASE1_SCOPE_EVENT ?? "local";
  const branch =
    args.branch ?? process.env.PHASE1_SCOPE_BRANCH ?? gitOutput(["branch", "--show-current"]);
  const explicitOperation = args.operation ?? process.env.PHASE1_OPERATION_ID;
  const eventBase = args.base ?? process.env.PHASE1_SCOPE_BASE;
  const headCommit = args.head ?? process.env.PHASE1_SCOPE_HEAD ?? gitOutput(["rev-parse", "HEAD"]);
  assertCommit(headCommit, "HEAD");

  let selectedRecord;
  if (branch && branch !== "main") {
    const branchRecords = records.filter(
      ({ execution }) => execution.implementationBranch === branch,
    );
    if (branchRecords.length > 1) {
      throw new Error(`AMBIGUOUS_BRANCH_OPERATION: ${branch}`);
    }
    [selectedRecord] = branchRecords;
  }

  if (explicitOperation) {
    resolveOperationDefinition(explicitOperation, operationManifest, writeScope);
    if (selectedRecord && selectedRecord.execution.operationId !== explicitOperation) {
      throw new Error(
        `MISMATCHED_EXPLICIT_OPERATION: explicit=${explicitOperation} execution=${selectedRecord.execution.operationId}`,
      );
    }
    if (!selectedRecord) {
      const candidates = records.filter(
        ({ execution }) =>
          execution.operationId === explicitOperation &&
          (!eventBase || execution.baseCommit === eventBase),
      );
      if (candidates.length === 1) {
        [selectedRecord] = candidates;
      } else if (candidates.length > 1) {
        throw new Error(`AMBIGUOUS_EXPLICIT_OPERATION: ${explicitOperation}`);
      }
    }
  }

  if (selectedRecord) {
    if (validateGovernanceAmendmentExecution(selectedRecord.execution)) {
      await verifyGovernanceAmendment({
        record: selectedRecord,
        event,
        branch,
        eventBase,
        headCommit,
        authorityLock,
        writeScope,
      });
      return;
    }
    const immutableAuthorityFilesVerified = await verifyImmutableAuthority(authorityLock);
    const operationId = selectedRecord.execution.operationId;
    const baseCommit = selectedRecord.execution.baseCommit;
    assertCommit(baseCommit, "EXECUTION_BASE");
    assertAncestor(baseCommit, headCommit);
    validateEventBase(event, branch, eventBase, baseCommit, headCommit);
    const operationStartGate = verifyOperationStartGate(operationId, baseCommit);
    const changedPaths = changedPathsFrom(baseCommit, headCommit);
    const authorityLockRefresh = await verifyOperationAuthorityTransition(
      baseCommit,
      authorityLock,
      operationId,
      changedPaths,
    );
    const violations = validateOperationChangedPaths(
      changedPaths.filter((path) => path !== AUTHORITY_LOCK_PATH),
      operationId,
      writeScope,
      authorityLock,
    );
    if (violations.length > 0) {
      throw new Error(violations.join("\n"));
    }
    reportAndExit({
      schemaVersion: "1.0.0",
      check: CHECK,
      result: "PASS",
      mode: "OPERATION_EXECUTION",
      operationId,
      executionRecord: selectedRecord.path,
      baseCommit,
      headCommit,
      branch,
      enforcementMode: writeScope.enforcementMode,
      operationStartGate,
      authorityLockRefresh,
      immutableAuthorityFilesVerified,
      changedPaths,
      violations,
    });
    return;
  }

  if (!eventBase) {
    throw new Error("MISSING_AUTHORIZED_BASE: no matching execution record or event base");
  }
  assertCommit(eventBase, "EVENT_BASE");
  assertAncestor(eventBase, headCommit);
  const changedPaths = changedPathsFrom(eventBase, headCommit);
  const changedExecutionRecords = records.filter(({ path }) => changedPaths.includes(path));
  const record = selectMergeExecutionRecord(changedExecutionRecords, eventBase);
  if (record) {
    if (validateGovernanceAmendmentExecution(record.execution)) {
      await verifyGovernanceAmendment({
        record,
        event,
        branch,
        eventBase,
        headCommit,
        authorityLock,
        writeScope,
      });
      return;
    }
    const immutableAuthorityFilesVerified = await verifyImmutableAuthority(authorityLock);
    const operationId = operationIdFromExecutionPath(record.path);
    if (explicitOperation && operationId !== explicitOperation) {
      throw new Error(
        `MISMATCHED_EXPLICIT_OPERATION: explicit=${explicitOperation} execution=${operationId}`,
      );
    }
    if (record.execution.baseCommit !== eventBase) {
      throw new Error(
        `MISMATCHED_AUTHORIZED_BASE: event=${eventBase} execution=${record.execution.baseCommit}`,
      );
    }
    const operationStartGate = verifyOperationStartGate(operationId, eventBase);
    const authorityLockRefresh = await verifyOperationAuthorityTransition(
      eventBase,
      authorityLock,
      operationId,
      changedPaths,
    );
    const violations = validateOperationChangedPaths(
      changedPaths.filter((path) => path !== AUTHORITY_LOCK_PATH),
      operationId,
      writeScope,
      authorityLock,
    );
    if (violations.length > 0) {
      throw new Error(violations.join("\n"));
    }
    reportAndExit({
      schemaVersion: "1.0.0",
      check: CHECK,
      result: "PASS",
      mode: "OPERATION_MERGE",
      operationId,
      executionRecord: record.path,
      baseCommit: eventBase,
      headCommit,
      branch,
      enforcementMode: writeScope.enforcementMode,
      operationStartGate,
      authorityLockRefresh,
      immutableAuthorityFilesVerified,
      changedPaths,
      violations,
    });
    return;
  }

  const evidenceOperation = selectEvidenceOperation(changedPaths);
  if (evidenceOperation) {
    const immutableAuthorityFilesVerified = await verifyImmutableAuthority(authorityLock);
    resolveOperationDefinition(evidenceOperation, operationManifest, writeScope);
    if (explicitOperation && explicitOperation !== evidenceOperation) {
      throw new Error(
        `MISMATCHED_EVIDENCE_OPERATION: explicit=${explicitOperation} evidence=${evidenceOperation}`,
      );
    }
    if (!records.some(({ execution }) => execution.operationId === evidenceOperation)) {
      throw new Error(`MISSING_OPERATION_EXECUTION: ${evidenceOperation}`);
    }
    const violations = validateOperationChangedPaths(
      changedPaths,
      evidenceOperation,
      writeScope,
      authorityLock,
    );
    if (violations.length > 0) {
      throw new Error(violations.join("\n"));
    }
    reportAndExit({
      schemaVersion: "1.0.0",
      check: CHECK,
      result: "PASS",
      mode: "INDEPENDENT_EVIDENCE",
      operationId: evidenceOperation,
      baseCommit: eventBase,
      headCommit,
      branch,
      enforcementMode: writeScope.enforcementMode,
      immutableAuthorityFilesVerified,
      changedPaths,
      violations,
    });
    return;
  }

  const governedPaths = changedPaths.filter((path) =>
    isPhase1GovernedPath(path, writeScope, authorityLock),
  );
  if (governedPaths.length > 0) {
    throw new Error(`MISSING_OPERATION_CONTEXT: ${governedPaths.join(",")}`);
  }
  const immutableAuthorityFilesVerified = await verifyImmutableAuthority(authorityLock);
  reportAndExit({
    schemaVersion: "1.0.0",
    check: CHECK,
    result: "PASS",
    mode: "NON_OPERATION_GOVERNANCE",
    operationId: null,
    baseCommit: eventBase,
    headCommit,
    branch,
    enforcementMode: writeScope.enforcementMode,
    immutableAuthorityFilesVerified,
    changedPaths,
    violations: [],
  });
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify(
      {
        schemaVersion: "1.0.0",
        check: CHECK,
        result: "FAIL_CLOSED",
        error: message,
        repositoryRoot: relative(process.cwd(), repositoryRoot) || ".",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
