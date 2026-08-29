const OPERATION_ID_PATTERN = /^P1-O0[1-9]$/;
const EXECUTION_PATH_PATTERN = /^operations\/phase-1\/executions\/p1-o(0[1-9])-[^/]+\.json$/;
const EVIDENCE_PATH_PATTERN = /^operations\/phase-1\/evidence\/o(0[1-9])\/[^/].*$/;
const GOVERNANCE_AMENDMENT_GATE_PATH_PATTERN =
  /^operations\/phase-1\/evidence\/o01\/p1-governance-amendment-authorization-issue-[1-9][0-9]*\.json$/;
const GOVERNANCE_AMENDMENT_PATH_PATTERNS = [
  /^operations\/phase-1\/[^/]+\.json$/,
  /^operations\/phase-1\/executions\/p1-o01-[^/]+\.json$/,
  /^operations\/phase-1\/evidence\/o01\/[^/]+\.json$/,
  /^docs\/roadmap\/phase-1-[^/]+\.md$/,
  /^docs\/reviews\/phase-1-[^/]+\.md$/,
];
const ALWAYS_FORBIDDEN_AMENDMENT_PATH_PATTERNS = [
  /^\.ai-(?:local|work)(?:\/|$)/,
  /^artifacts(?:\/|$)/,
  /^dist(?:\/|$)/,
  /^node_modules(?:\/|$)/,
  /^apps(?:\/|$)/,
  /^packages(?:\/|$)/,
  /^docs\/decisions(?:\/|$)/,
  GOVERNANCE_AMENDMENT_GATE_PATH_PATTERN,
];

export const GOVERNANCE_AMENDMENT_EXECUTION_TYPE = "PHASE_1_GOVERNANCE_AMENDMENT";
export const GOVERNANCE_AMENDMENT_EVIDENCE_TYPE = "Phase1GovernanceAmendmentAuthorization";

export const P1_O02_START_GATE_PATH =
  "operations/phase-1/evidence/o01/p1-transition-scope-independent-gate.json";

export function globToRegex(pattern) {
  const segments = pattern.split("**").map((segment) =>
    segment
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]"),
  );
  return new RegExp(`^${segments.join(".*")}$`);
}

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => globToRegex(pattern).test(path));
}

export function operationIdFromExecutionPath(path) {
  const match = EXECUTION_PATH_PATTERN.exec(path);
  return match ? `P1-O${match[1]}` : undefined;
}

export function operationIdFromEvidencePath(path) {
  const match = EVIDENCE_PATH_PATTERN.exec(path);
  return match ? `P1-O${match[1]}` : undefined;
}

export function resolveOperationDefinition(operationId, operationManifest, writeScope) {
  if (!OPERATION_ID_PATTERN.test(operationId)) {
    throw new Error(`UNKNOWN_OPERATION: ${operationId || "<missing>"}`);
  }

  const manifestMatches = operationManifest.suboperations.filter(
    (item) => item.operationId === operationId,
  );
  const scopeMatches = writeScope.operations.filter((item) => item.operationId === operationId);
  if (manifestMatches.length !== 1 || scopeMatches.length !== 1) {
    throw new Error(
      `AMBIGUOUS_OPERATION: ${operationId} manifest=${manifestMatches.length} scope=${scopeMatches.length}`,
    );
  }

  const [manifestOperation] = manifestMatches;
  const [operationScope] = scopeMatches;
  if (manifestOperation.writeScopeOperationId !== operationId) {
    throw new Error(
      `MISMATCHED_OPERATION_SCOPE: ${operationId} -> ${manifestOperation.writeScopeOperationId}`,
    );
  }
  return { manifestOperation, operationScope };
}

export function validateExecutionRecord(path, execution, operationManifest, writeScope) {
  const pathOperationId = operationIdFromExecutionPath(path);
  if (!pathOperationId) {
    throw new Error(`INVALID_EXECUTION_PATH: ${path}`);
  }
  if (
    execution.operationId !== pathOperationId ||
    execution.writeScopeOperationId !== pathOperationId
  ) {
    throw new Error(
      `MISMATCHED_EXECUTION_OPERATION: ${path} path=${pathOperationId} operation=${execution.operationId} scope=${execution.writeScopeOperationId}`,
    );
  }
  if (!/^[0-9a-f]{40}$/.test(execution.baseCommit ?? "")) {
    throw new Error(`INVALID_EXECUTION_BASE: ${path}`);
  }
  if (
    typeof execution.implementationBranch !== "string" ||
    execution.implementationBranch.length === 0
  ) {
    throw new Error(`MISSING_EXECUTION_BRANCH: ${path}`);
  }
  resolveOperationDefinition(pathOperationId, operationManifest, writeScope);
  return pathOperationId;
}

export function validateP1O02StartGate(gate) {
  if (
    gate?.schemaVersion !== "1.0.0" ||
    gate?.evidenceType !== "IndependentPhase1TransitionGate" ||
    gate?.trackingIssue !== 11 ||
    gate?.decision !== "PASS" ||
    gate?.authorization?.p1O02Start !== "RELEASED" ||
    gate?.verifier?.role !== "INDEPENDENT_VERIFIER" ||
    gate?.verifier?.independent !== true ||
    !/^[0-9a-f]{40}$/.test(gate?.subject?.remediationImplementationCommit ?? "")
  ) {
    throw new Error("P1_O02_START_BLOCKED: Issue #11 independent PASS Gate is missing or invalid");
  }
  return gate.subject.remediationImplementationCommit;
}

function isSafeRepositoryPath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.split("/").includes("..") &&
    !/[?*[\]]/.test(path)
  );
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateGovernanceAmendmentExecution(execution) {
  if (execution.executionType !== GOVERNANCE_AMENDMENT_EXECUTION_TYPE) {
    return undefined;
  }
  if (execution.operationId !== "P1-O01" || execution.writeScopeOperationId !== "P1-O01") {
    throw new Error("INVALID_GOVERNANCE_AMENDMENT_OWNER: expected P1-O01");
  }
  if (!Number.isSafeInteger(execution.trackingIssue) || execution.trackingIssue < 1) {
    throw new Error("INVALID_GOVERNANCE_AMENDMENT_ISSUE");
  }
  const expectedGatePath =
    `operations/phase-1/evidence/o01/` +
    `p1-governance-amendment-authorization-issue-${execution.trackingIssue}.json`;
  if (
    !GOVERNANCE_AMENDMENT_GATE_PATH_PATTERN.test(execution.priorAuthorizationGateRef ?? "") ||
    execution.priorAuthorizationGateRef !== expectedGatePath
  ) {
    throw new Error("INVALID_GOVERNANCE_AMENDMENT_GATE_REF");
  }
  return {
    trackingIssue: execution.trackingIssue,
    implementationBranch: execution.implementationBranch,
    baseCommit: execution.baseCommit,
    gatePath: execution.priorAuthorizationGateRef,
  };
}

export function selectGovernanceAmendmentAuthorizationGate(candidates, request) {
  const matches = candidates.filter(
    ({ gate }) =>
      gate?.evidenceType === GOVERNANCE_AMENDMENT_EVIDENCE_TYPE &&
      gate?.trackingIssue === request.trackingIssue,
  );
  if (matches.length === 0) {
    throw new Error("MISSING_PRIOR_GOVERNANCE_AMENDMENT_GATE");
  }
  if (matches.length !== 1) {
    throw new Error(`AMBIGUOUS_PRIOR_GOVERNANCE_AMENDMENT_GATE: ${matches.length}`);
  }
  if (matches[0].path !== request.gatePath) {
    throw new Error(
      `MISMATCHED_PRIOR_GOVERNANCE_AMENDMENT_GATE: expected=${request.gatePath} actual=${matches[0].path}`,
    );
  }
  return matches[0].gate;
}

export function validateGovernanceAmendmentAuthorizationGate(
  gate,
  { request, repository, baseCommit, baseParentCommit },
) {
  const allowedChangedPaths = gate?.authorization?.allowedChangedPaths;
  if (
    gate?.schemaVersion !== "1.0.0" ||
    gate?.evidenceType !== GOVERNANCE_AMENDMENT_EVIDENCE_TYPE ||
    gate?.trackingIssue !== request.trackingIssue ||
    gate?.decision !== "AUTHORIZED" ||
    gate?.subject?.repository !== repository ||
    gate?.subject?.authorizationBase !== baseParentCommit ||
    gate?.subject?.authorizedBasePolicy !== "DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE" ||
    gate?.subject?.implementationBranch !== request.implementationBranch ||
    gate?.verifier?.role !== "INDEPENDENT_VERIFIER" ||
    gate?.verifier?.independent !== true ||
    gate?.verifier?.readOnlySubjectVerification !== true ||
    gate?.verifier?.remediationPerformed !== false ||
    gate?.authorization?.mode !== "GOVERNANCE_AMENDMENT" ||
    gate?.authorization?.unlistedPhase1AuthorityPaths !== "DENIED" ||
    gate?.claimBoundary?.acceptedAdrMutationAuthorized !== false ||
    gate?.claimBoundary?.productionRuntimeAuthorized !== false ||
    gate?.claimBoundary?.p1O02ImplementationAuthorized !== false ||
    request.baseCommit !== baseCommit ||
    !Array.isArray(allowedChangedPaths) ||
    allowedChangedPaths.length === 0
  ) {
    throw new Error("MALFORMED_OR_MISMATCHED_GOVERNANCE_AMENDMENT_GATE");
  }

  const uniquePaths = [...new Set(allowedChangedPaths)];
  if (uniquePaths.length !== allowedChangedPaths.length) {
    throw new Error("DUPLICATE_GOVERNANCE_AMENDMENT_ALLOWED_PATH");
  }
  if (!sameJson([...allowedChangedPaths].sort(), allowedChangedPaths)) {
    throw new Error("NON_CANONICAL_GOVERNANCE_AMENDMENT_ALLOWED_PATHS");
  }
  for (const path of allowedChangedPaths) {
    if (!isSafeRepositoryPath(path)) {
      throw new Error(`INVALID_GOVERNANCE_AMENDMENT_ALLOWED_PATH: ${path}`);
    }
    if (ALWAYS_FORBIDDEN_AMENDMENT_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      throw new Error(`FORBIDDEN_GOVERNANCE_AMENDMENT_ALLOWED_PATH: ${path}`);
    }
    if (!GOVERNANCE_AMENDMENT_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      throw new Error(`NON_GOVERNANCE_AMENDMENT_ALLOWED_PATH: ${path}`);
    }
  }
  return { allowedChangedPaths };
}

export function validateGovernanceAmendmentChangedPaths(changedPaths, allowedChangedPaths) {
  const allowed = new Set(allowedChangedPaths);
  const violations = [];
  for (const path of changedPaths) {
    if (!isSafeRepositoryPath(path)) {
      violations.push(`INVALID_PATH: ${path}`);
    } else if (!allowed.has(path)) {
      violations.push(`GOVERNANCE_AMENDMENT_EXTRA_PATH: ${path}`);
    }
  }
  return violations;
}

export function validateAuthorityLockTransition(baseLock, headLock, allowedChangedPaths) {
  const violations = [];
  const baseTop = { ...baseLock, authorityFiles: undefined };
  const headTop = { ...headLock, authorityFiles: undefined };
  if (!sameJson(baseTop, headTop)) {
    violations.push("AUTHORITY_LOCK_TOP_LEVEL_MUTATION");
  }

  const baseEntries = new Map(baseLock.authorityFiles.map((entry) => [entry.path, entry]));
  const headEntries = new Map(headLock.authorityFiles.map((entry) => [entry.path, entry]));
  if (
    baseEntries.size !== baseLock.authorityFiles.length ||
    headEntries.size !== headLock.authorityFiles.length
  ) {
    violations.push("AUTHORITY_LOCK_DUPLICATE_PATH");
  }
  const basePaths = [...baseEntries.keys()].sort();
  const headPaths = [...headEntries.keys()].sort();
  if (!sameJson(basePaths, headPaths)) {
    violations.push("AUTHORITY_LOCK_PATH_SET_MUTATION");
    return violations;
  }

  const allowed = new Set(allowedChangedPaths);
  for (const path of basePaths) {
    const baseEntry = baseEntries.get(path);
    const headEntry = headEntries.get(path);
    const baseOwnership = { ...baseEntry, sha256: undefined };
    const headOwnership = { ...headEntry, sha256: undefined };
    if (!sameJson(baseOwnership, headOwnership)) {
      violations.push(`AUTHORITY_LOCK_OWNERSHIP_MUTATION: ${path}`);
    } else if (!allowed.has(path) && !sameJson(baseEntry, headEntry)) {
      violations.push(`UNRELATED_AUTHORITY_LOCK_MUTATION: ${path}`);
    }
  }
  return violations;
}

export function validateAuthorityLockHashes(authorityLock, actualHashes) {
  const failures = [];
  const seen = new Set();
  for (const entry of authorityLock.authorityFiles) {
    if (seen.has(entry.path)) {
      failures.push(`AUTHORITY_LOCK_DUPLICATE_PATH: ${entry.path}`);
      continue;
    }
    seen.add(entry.path);
    const actual = actualHashes.get(entry.path);
    if (!actual) {
      failures.push(`AUTHORITY_FILE_MISSING: ${entry.path}`);
    } else if (actual !== entry.sha256) {
      failures.push(`AUTHORITY_HASH_MISMATCH: ${entry.path}`);
    }
  }
  if (seen.has(authorityLock.excludedSelfPath)) {
    failures.push("AUTHORITY_LOCK_SELF_HASHED");
  }
  return failures;
}

export function selectEvidenceOperation(changedPaths) {
  const operationIds = new Set(changedPaths.map(operationIdFromEvidencePath));
  if (operationIds.has(undefined) || operationIds.size !== 1) {
    return undefined;
  }
  return [...operationIds][0];
}

export function isPhase1GovernedPath(path, writeScope, authorityLock) {
  return (
    path.startsWith("operations/phase-1/") ||
    matchesAny(path, writeScope.globalAllowedPathGlobs) ||
    matchesAny(path, writeScope.globalDeniedPathGlobs) ||
    authorityLock.authorityFiles.some((entry) => entry.path === path)
  );
}

export function validateOperationChangedPaths(
  changedPaths,
  operationId,
  writeScope,
  authorityLock,
) {
  const operationScope = writeScope.operations.find((item) => item.operationId === operationId);
  if (!operationScope) {
    throw new Error(`UNKNOWN_OPERATION_SCOPE: ${operationId}`);
  }

  const authorityByPath = new Map(authorityLock.authorityFiles.map((entry) => [entry.path, entry]));
  const violations = [];
  for (const path of changedPaths) {
    if (path.startsWith("/") || path.split("/").includes("..")) {
      violations.push(`INVALID_PATH: ${path}`);
      continue;
    }

    if (
      matchesAny(path, writeScope.globalDeniedPathGlobs) ||
      matchesAny(path, operationScope.deniedPathGlobs)
    ) {
      violations.push(`DENIED: ${path}`);
    } else if (
      !matchesAny(path, writeScope.globalAllowedPathGlobs) ||
      !matchesAny(path, operationScope.allowedPathGlobs)
    ) {
      violations.push(`NOT_ALLOWED: ${path}`);
    }

    const authority = authorityByPath.get(path);
    if (authority?.mutationPolicy === "IMMUTABLE") {
      violations.push(`IMMUTABLE: ${path}`);
    } else if (
      authority?.mutationPolicy === "OPERATION_SCOPED" &&
      !authority.allowedOperationIds.includes(operationId)
    ) {
      violations.push(`AUTHORITY_OPERATION_DENIED: ${path}`);
    }
  }
  return violations;
}
