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
const AUTHORITY_OWNERSHIP_DELTA_KEYS = [
  "afterAllowedOperationIds",
  "beforeAllowedOperationIds",
  "path",
];

export const GOVERNANCE_AMENDMENT_EXECUTION_TYPE = "PHASE_1_GOVERNANCE_AMENDMENT";
export const GOVERNANCE_AMENDMENT_EVIDENCE_TYPE = "Phase1GovernanceAmendmentAuthorization";
export const AUTHORITY_LOCK_PATH = "operations/phase-1/authority-lock.json";
export const P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT =
  "69804341c21c220863389571d9b5be8796eb0382";
export const P1_O04_FINAL_AMENDMENT_EXECUTION_PATH =
  "operations/phase-1/executions/p1-o01-p1-o04-final-scope-authority-amendment.json";
export const P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH =
  "operations/phase-1/evidence/o01/p1-o04-final-scope-authority-amendment.json";
export const P1_O04_REQUIRED_SCOPE_PATHS = [
  "package.json",
  "packages/contracts/README.md",
  "packages/contracts/planned-contracts.json",
  "packages/contracts/schema-inventory.json",
  "packages/contracts/schema-registry.json",
  "packages/contracts/src/types.generated.ts",
  "packages/contracts/type-bindings.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tests/contract/inventory-integrity.test.mjs",
  "tests/contract/registry-integrity.test.mjs",
  "tests/contract/runtime-validator.test.mjs",
  "tests/contract/schema-type-consistency.test.mjs",
  "tsconfig.build.json",
  "vitest.config.mjs",
];
export const P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS = [
  "packages/contracts/planned-contracts.json",
  "packages/contracts/schema-inventory.json",
  "packages/contracts/schema-registry.json",
];
export const P1_O04_FINAL_AMENDMENT_CHANGED_PATHS = [
  "docs/roadmap/phase-1-write-scope.md",
  AUTHORITY_LOCK_PATH,
  P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
  P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
  "operations/phase-1/write-scope.json",
];
export const P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS =
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.map((path) => ({
    afterAllowedOperationIds: ["P1-O02", "P1-O04"],
    beforeAllowedOperationIds: ["P1-O02"],
    path,
  }));

export const P1_O02_START_GATE_PATH =
  "operations/phase-1/evidence/o01/p1-transition-scope-independent-gate.json";
export const P1_O04_START_GATE_PATH =
  "operations/phase-1/evidence/o01/p1-o04-resume-after-issue-29-independent-gate.json";
export const P1_O05_START_GATE_PATH =
  "operations/phase-1/evidence/o01/p1-o05-start-after-issue-53-independent-gate.json";
export const P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT =
  "15b42b2c9c84d06aae99def832ef4c59d195c6cb";
export const P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT =
  "62e2de7225503c48c66fc08c6883d397aef5518a";
export const P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH =
  "operations/phase-1/executions/p1-o01-p1-o05-scope-authority-amendment.json";
export const P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH =
  "operations/phase-1/evidence/o01/p1-o05-scope-authority-amendment.json";
export const P1_O05_REQUIRED_SCOPE_PATHS = [
  "package.json",
  "packages/contracts/README.md",
  "packages/contracts/planned-contracts.json",
  "packages/contracts/schema-inventory.json",
  "packages/contracts/schema-registry.json",
  "packages/contracts/src/types.generated.ts",
  "packages/contracts/type-bindings.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.build.json",
  "vitest.config.mjs",
];
export const P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS = [
  "packages/contracts/planned-contracts.json",
  "packages/contracts/schema-inventory.json",
  "packages/contracts/schema-registry.json",
];
export const P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS = [
  "docs/roadmap/phase-1-write-scope.md",
  AUTHORITY_LOCK_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
  "operations/phase-1/write-scope.json",
];
export const P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS =
  P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.map((path) => ({
    afterAllowedOperationIds: ["P1-O02", "P1-O04", "P1-O05"],
    beforeAllowedOperationIds: ["P1-O02", "P1-O04"],
    path,
  }));

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

export function isSafeRepositoryPath(path) {
  const segments = typeof path === "string" ? path.split("/") : [];
  const hasInvalidControl =
    typeof path === "string" &&
    [...path].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint < 32 || (codePoint >= 127 && codePoint <= 159) || codePoint === 0xfffd;
    });
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !/^[A-Za-z]:/.test(path) &&
    !path.includes("\\") &&
    !hasInvalidControl &&
    path.normalize("NFC") === path &&
    segments.every((segment) => segment !== "" && segment !== "." && segment !== "..") &&
    !/[?*[\]]/.test(path)
  );
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isCanonicalUniqueStrings(values) {
  return (
    Array.isArray(values) &&
    values.every((value) => typeof value === "string") &&
    new Set(values).size === values.length &&
    sameJson([...values].sort(), values)
  );
}

function validateCanonicalOperationIds(values, label) {
  if (
    !isCanonicalUniqueStrings(values) ||
    !values.every((value) => OPERATION_ID_PATTERN.test(value))
  ) {
    throw new Error(`NON_CANONICAL_${label}`);
  }
}

function validateCanonicalAmendmentPaths(paths, label) {
  if (!isCanonicalUniqueStrings(paths) || paths.length === 0) {
    throw new Error(`NON_CANONICAL_${label}`);
  }
  for (const path of paths) {
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
}

function validateAuthorityOwnershipDeltas(deltas) {
  if (!Array.isArray(deltas)) {
    throw new Error("MALFORMED_AUTHORITY_OWNERSHIP_DELTAS");
  }
  const paths = deltas.map((delta) => delta?.path);
  if (!isCanonicalUniqueStrings(paths)) {
    throw new Error("NON_CANONICAL_AUTHORITY_OWNERSHIP_DELTAS");
  }
  for (const delta of deltas) {
    if (
      delta === null ||
      typeof delta !== "object" ||
      !sameJson(Object.keys(delta).sort(), AUTHORITY_OWNERSHIP_DELTA_KEYS)
    ) {
      throw new Error("MALFORMED_AUTHORITY_OWNERSHIP_DELTA");
    }
    if (!isSafeRepositoryPath(delta.path) || delta.path === AUTHORITY_LOCK_PATH) {
      throw new Error(`INVALID_AUTHORITY_OWNERSHIP_DELTA_PATH: ${delta.path}`);
    }
    validateCanonicalOperationIds(
      delta.beforeAllowedOperationIds,
      "AUTHORITY_OWNERSHIP_DELTA_BEFORE_OPERATION_IDS",
    );
    validateCanonicalOperationIds(
      delta.afterAllowedOperationIds,
      "AUTHORITY_OWNERSHIP_DELTA_AFTER_OPERATION_IDS",
    );
    if (sameJson(delta.beforeAllowedOperationIds, delta.afterAllowedOperationIds)) {
      throw new Error(`EMPTY_AUTHORITY_OWNERSHIP_DELTA: ${delta.path}`);
    }
  }
}

function collectAuthorityEntries(lock, side, violations) {
  if (!Array.isArray(lock?.authorityFiles)) {
    violations.push(`AUTHORITY_LOCK_MALFORMED_${side}`);
    return new Map();
  }
  const entries = new Map();
  const paths = [];
  for (const entry of lock.authorityFiles) {
    const path = entry?.path;
    if (!isSafeRepositoryPath(path)) {
      violations.push(`AUTHORITY_LOCK_UNSAFE_PATH: ${String(path)}`);
      continue;
    }
    paths.push(path);
    if (entries.has(path)) {
      violations.push(`AUTHORITY_LOCK_DUPLICATE_PATH: ${path}`);
      continue;
    }
    entries.set(path, entry);
    if (!isCanonicalUniqueStrings(entry.allowedOperationIds)) {
      violations.push(`AUTHORITY_LOCK_NON_CANONICAL_ALLOWED_OPERATION_IDS: ${path}`);
    } else if (!entry.allowedOperationIds.every((value) => OPERATION_ID_PATTERN.test(value))) {
      violations.push(`AUTHORITY_LOCK_INVALID_ALLOWED_OPERATION_ID: ${path}`);
    }
  }
  if (!sameJson([...paths].sort(), paths)) {
    violations.push(`AUTHORITY_LOCK_NON_CANONICAL_PATH_ORDER: ${side}`);
  }
  return entries;
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
  const exactAmendmentPaths = gate?.authorization?.exactAmendmentPaths;
  const authorityOwnershipDeltas = gate?.authorization?.authorityOwnershipDeltas;
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

  validateCanonicalAmendmentPaths(allowedChangedPaths, "GOVERNANCE_AMENDMENT_ALLOWED_PATHS");
  if (exactAmendmentPaths !== undefined) {
    validateCanonicalAmendmentPaths(exactAmendmentPaths, "GOVERNANCE_AMENDMENT_EXACT_PATHS");
    if (exactAmendmentPaths.some((path) => !allowedChangedPaths.includes(path))) {
      throw new Error("GOVERNANCE_AMENDMENT_EXACT_PATH_OUTSIDE_ALLOWLIST");
    }
  }
  if (authorityOwnershipDeltas !== undefined) {
    validateAuthorityOwnershipDeltas(authorityOwnershipDeltas);
    if (exactAmendmentPaths === undefined || !exactAmendmentPaths.includes(AUTHORITY_LOCK_PATH)) {
      throw new Error("AUTHORITY_OWNERSHIP_DELTA_REQUIRES_EXACT_AUTHORITY_LOCK_AMENDMENT");
    }
  }
  const authorization = { allowedChangedPaths };
  if (exactAmendmentPaths !== undefined) {
    authorization.exactAmendmentPaths = exactAmendmentPaths;
  }
  if (authorityOwnershipDeltas !== undefined) {
    authorization.authorityOwnershipDeltas = authorityOwnershipDeltas;
  }
  return authorization;
}

export function validateGovernanceAmendmentChangedPaths(
  changedPaths,
  allowedChangedPaths,
  exactAmendmentPaths,
) {
  const allowed = new Set(allowedChangedPaths);
  const violations = [];
  if (!isCanonicalUniqueStrings(changedPaths)) {
    violations.push("NON_CANONICAL_GOVERNANCE_AMENDMENT_CHANGED_PATHS");
  }
  for (const path of changedPaths) {
    if (!isSafeRepositoryPath(path)) {
      violations.push(`INVALID_PATH: ${path}`);
    } else if (!allowed.has(path)) {
      violations.push(`GOVERNANCE_AMENDMENT_EXTRA_PATH: ${path}`);
    }
  }
  if (exactAmendmentPaths !== undefined) {
    const changed = new Set(changedPaths);
    const exact = new Set(exactAmendmentPaths);
    for (const path of exactAmendmentPaths) {
      if (!changed.has(path)) {
        violations.push(`GOVERNANCE_AMENDMENT_MISSING_EXACT_PATH: ${path}`);
      }
    }
    for (const path of changedPaths) {
      if (!exact.has(path)) {
        violations.push(`GOVERNANCE_AMENDMENT_NON_EXACT_PATH: ${path}`);
      }
    }
  }
  return violations;
}

export function validateAuthorityLockTransition(
  baseLock,
  headLock,
  allowedChangedPaths,
  authorityOwnershipDeltas = [],
) {
  const violations = [];
  const baseTop = { ...baseLock, authorityFiles: undefined };
  const headTop = { ...headLock, authorityFiles: undefined };
  if (!sameJson(baseTop, headTop)) {
    violations.push("AUTHORITY_LOCK_TOP_LEVEL_MUTATION");
  }

  const baseEntries = collectAuthorityEntries(baseLock, "BASE", violations);
  const headEntries = collectAuthorityEntries(headLock, "HEAD", violations);
  const basePaths = [...baseEntries.keys()].sort();
  const headPaths = [...headEntries.keys()].sort();
  if (!sameJson(basePaths, headPaths)) {
    violations.push("AUTHORITY_LOCK_PATH_SET_MUTATION");
    return violations;
  }

  const allowed = new Set(allowedChangedPaths);
  const authorizedDeltas = new Map(authorityOwnershipDeltas.map((delta) => [delta.path, delta]));
  const observedDeltas = new Set();
  for (const path of basePaths) {
    const baseEntry = baseEntries.get(path);
    const headEntry = headEntries.get(path);
    const baseFixed = { ...baseEntry, sha256: undefined, allowedOperationIds: undefined };
    const headFixed = { ...headEntry, sha256: undefined, allowedOperationIds: undefined };
    if (!sameJson(baseFixed, headFixed)) {
      violations.push(`AUTHORITY_LOCK_OWNERSHIP_MUTATION: ${path}`);
      continue;
    }

    if (!sameJson(baseEntry.allowedOperationIds, headEntry.allowedOperationIds)) {
      const delta = authorizedDeltas.get(path);
      if (!delta) {
        violations.push(`UNAUTHORIZED_AUTHORITY_OWNERSHIP_DELTA: ${path}`);
      } else if (
        baseEntry.mutationPolicy !== "OPERATION_SCOPED" ||
        !sameJson(delta.beforeAllowedOperationIds, baseEntry.allowedOperationIds) ||
        !sameJson(delta.afterAllowedOperationIds, headEntry.allowedOperationIds)
      ) {
        violations.push(`MISMATCHED_AUTHORITY_OWNERSHIP_DELTA: ${path}`);
      } else {
        observedDeltas.add(path);
      }
    }

    if (!allowed.has(path) && baseEntry.sha256 !== headEntry.sha256) {
      violations.push(`UNRELATED_AUTHORITY_LOCK_MUTATION: ${path}`);
    }
  }
  for (const path of authorizedDeltas.keys()) {
    if (!baseEntries.has(path) || !observedDeltas.has(path)) {
      violations.push(`EXTRA_AUTHORIZED_AUTHORITY_OWNERSHIP_DELTA: ${path}`);
    }
  }
  return violations;
}

export function validateOperationAuthorityLockTransition(
  baseLock,
  headLock,
  operationId,
  changedPaths,
  actualHashes,
) {
  const violations = [];
  const baseTop = { ...baseLock, authorityFiles: undefined };
  const headTop = { ...headLock, authorityFiles: undefined };
  if (!sameJson(baseTop, headTop)) {
    violations.push("AUTHORITY_LOCK_TOP_LEVEL_MUTATION");
  }
  const baseEntries = collectAuthorityEntries(baseLock, "BASE", violations);
  const headEntries = collectAuthorityEntries(headLock, "HEAD", violations);
  const basePaths = [...baseEntries.keys()].sort();
  const headPaths = [...headEntries.keys()].sort();
  if (!sameJson(basePaths, headPaths)) {
    violations.push("AUTHORITY_LOCK_PATH_SET_MUTATION");
    return violations;
  }
  if (headEntries.has(headLock.excludedSelfPath)) {
    violations.push("AUTHORITY_LOCK_SELF_HASHED");
  }

  const changed = new Set(changedPaths);
  const lockChanged = changed.has(AUTHORITY_LOCK_PATH);
  const refreshedPaths = [];
  for (const path of basePaths) {
    const baseEntry = baseEntries.get(path);
    const headEntry = headEntries.get(path);
    const baseOwnership = { ...baseEntry, sha256: undefined };
    const headOwnership = { ...headEntry, sha256: undefined };
    if (!sameJson(baseOwnership, headOwnership)) {
      violations.push(`AUTHORITY_LOCK_OWNERSHIP_MUTATION: ${path}`);
      continue;
    }

    const hashChanged = baseEntry.sha256 !== headEntry.sha256;
    if (hashChanged) {
      refreshedPaths.push(path);
      if (!lockChanged || !changed.has(path)) {
        violations.push(`UNRELATED_AUTHORITY_HASH_REFRESH: ${path}`);
      }
      if (
        baseEntry.mutationPolicy !== "OPERATION_SCOPED" ||
        !baseEntry.allowedOperationIds.includes(operationId)
      ) {
        violations.push(`UNAUTHORIZED_AUTHORITY_HASH_REFRESH: ${path}`);
      }
    }

    if (changed.has(path)) {
      if (
        baseEntry.mutationPolicy !== "OPERATION_SCOPED" ||
        !baseEntry.allowedOperationIds.includes(operationId)
      ) {
        violations.push(`UNAUTHORIZED_LOCKED_ASSET_CHANGE: ${path}`);
      }
      if (!lockChanged) {
        violations.push(`AUTHORITY_LOCK_REFRESH_MISSING: ${path}`);
      }
      const actualHash = actualHashes.get(path);
      if (!actualHash || headEntry.sha256 !== actualHash) {
        violations.push(`AUTHORITY_LOCK_REFRESH_HASH_MISMATCH: ${path}`);
      }
      if (actualHash && actualHash !== baseEntry.sha256 && !hashChanged) {
        violations.push(`AUTHORITY_LOCK_REFRESH_MISSING: ${path}`);
      }
    }
  }
  if (lockChanged && refreshedPaths.length === 0) {
    violations.push("AUTHORITY_LOCK_EMPTY_REFRESH");
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

export function validateP1O04StartGate(gate) {
  const commits = {
    preliminaryScopeAmendmentMainCommit: gate?.subject?.preliminaryScopeAmendmentMainCommit,
    transitionEnforcementImplementationCommit:
      gate?.subject?.transitionEnforcementImplementationCommit,
    transitionEnforcementReviewedHeadCommit: gate?.subject?.transitionEnforcementReviewedHeadCommit,
    transitionEnforcementMainCommit: gate?.subject?.transitionEnforcementMainCommit,
    finalAmendmentAuthorizationGateReviewedHeadCommit:
      gate?.subject?.finalAmendmentAuthorizationGateReviewedHeadCommit,
    finalAmendmentAuthorizationGateMainCommit:
      gate?.subject?.finalAmendmentAuthorizationGateMainCommit,
    finalAmendmentImplementationCommit: gate?.subject?.finalAmendmentImplementationCommit,
    finalAmendmentReviewedHeadCommit: gate?.subject?.finalAmendmentReviewedHeadCommit,
    finalAmendmentMainCommit: gate?.subject?.finalAmendmentMainCommit,
  };
  const trees = {
    transitionEnforcementImplementationTree: gate?.subject?.transitionEnforcementImplementationTree,
    finalAmendmentImplementationTree: gate?.subject?.finalAmendmentImplementationTree,
  };
  const verification = gate?.verification;
  if (
    gate?.schemaVersion !== "1.0.0" ||
    gate?.evidenceType !== "IndependentPhase1TransitionGate" ||
    gate?.trackingIssue !== 29 ||
    gate?.decision !== "PASS" ||
    gate?.subject?.repository !== "olu37776-bit/-ai-software-engineering-os" ||
    !Object.values(commits).every((commit) => /^[0-9a-f]{40}$/.test(commit ?? "")) ||
    !Object.values(trees).every((tree) => /^[0-9a-f]{40}$/.test(tree ?? "")) ||
    commits.preliminaryScopeAmendmentMainCommit !==
      P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT ||
    !Number.isSafeInteger(gate?.subject?.finalAmendmentTrackingIssue) ||
    gate.subject.finalAmendmentTrackingIssue < 1 ||
    gate?.subject?.finalAmendmentExecutionPath !== P1_O04_FINAL_AMENDMENT_EXECUTION_PATH ||
    gate?.subject?.finalAmendmentEvidencePath !== P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH ||
    gate?.verifier?.role !== "INDEPENDENT_VERIFIER" ||
    gate?.verifier?.independent !== true ||
    gate?.verifier?.readOnlySubjectVerification !== true ||
    gate?.verifier?.remediationPerformed !== false ||
    gate?.authorization?.p1O04Start !== "RELEASED" ||
    gate?.authorization?.authorizedBasePolicy !==
      "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS" ||
    !sameJson(
      gate?.authorization?.finalAmendmentChangedPaths,
      P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
    ) ||
    !sameJson(
      gate?.authorization?.finalAuthorityOwnershipDeltas,
      P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    ) ||
    verification?.transitionEnforcementIndependentVerdict !== "PASS" ||
    verification?.transitionEnforcementExactHeadChecks !== "PASS" ||
    verification?.transitionEnforcementPostMergeChecks !== "PASS" ||
    verification?.finalAmendmentIndependentVerdict !== "PASS" ||
    verification?.finalAmendmentExactHeadChecks !== "PASS" ||
    verification?.finalAmendmentPostMergeChecks !== "PASS" ||
    gate?.claimBoundary?.acceptedAdrChanged !== false ||
    gate?.claimBoundary?.requiredCheckIdentityChanged !== false
  ) {
    throw new Error("P1_O04_START_BLOCKED: Issue #29 independent PASS Gate is missing or invalid");
  }
  return {
    ...commits,
    ...trees,
    finalAmendmentTrackingIssue: gate.subject.finalAmendmentTrackingIssue,
    finalAmendmentExecutionPath: gate.subject.finalAmendmentExecutionPath,
    finalAmendmentEvidencePath: gate.subject.finalAmendmentEvidencePath,
  };
}

export function validateP1O05StartGate(gate) {
  const commits = {
    scopeAuthorizationGateReviewedHeadCommit:
      gate?.subject?.scopeAuthorizationGateReviewedHeadCommit,
    scopeAuthorizationGateMainCommit: gate?.subject?.scopeAuthorizationGateMainCommit,
    scopeAuthorityAmendmentImplementationCommit:
      gate?.subject?.scopeAuthorityAmendmentImplementationCommit,
    scopeAuthorityAmendmentReviewedHeadCommit:
      gate?.subject?.scopeAuthorityAmendmentReviewedHeadCommit,
    scopeAuthorityAmendmentMainCommit: gate?.subject?.scopeAuthorityAmendmentMainCommit,
    transitionEnforcementImplementationCommit:
      gate?.subject?.transitionEnforcementImplementationCommit,
    transitionEnforcementReviewedHeadCommit: gate?.subject?.transitionEnforcementReviewedHeadCommit,
    transitionEnforcementMainCommit: gate?.subject?.transitionEnforcementMainCommit,
  };
  const trees = {
    scopeAuthorityAmendmentImplementationTree:
      gate?.subject?.scopeAuthorityAmendmentImplementationTree,
    transitionEnforcementImplementationTree: gate?.subject?.transitionEnforcementImplementationTree,
  };
  const verification = gate?.verification;
  if (
    gate?.schemaVersion !== "1.0.0" ||
    gate?.evidenceType !== "IndependentPhase1TransitionGate" ||
    gate?.trackingIssue !== 53 ||
    gate?.decision !== "PASS" ||
    gate?.subject?.repository !== "olu37776-bit/-ai-software-engineering-os" ||
    !Object.values(commits).every((commit) => /^[0-9a-f]{40}$/.test(commit ?? "")) ||
    !Object.values(trees).every((tree) => /^[0-9a-f]{40}$/.test(tree ?? "")) ||
    commits.scopeAuthorizationGateMainCommit !== P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT ||
    commits.scopeAuthorityAmendmentMainCommit !==
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT ||
    gate?.subject?.scopeAuthorityAmendmentExecutionPath !==
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH ||
    gate?.subject?.scopeAuthorityAmendmentEvidencePath !==
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH ||
    gate?.verifier?.role !== "INDEPENDENT_VERIFIER" ||
    gate?.verifier?.independent !== true ||
    gate?.verifier?.readOnlySubjectVerification !== true ||
    gate?.verifier?.remediationPerformed !== false ||
    gate?.authorization?.p1O05Start !== "RELEASED" ||
    gate?.authorization?.authorizedBasePolicy !==
      "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS" ||
    !sameJson(
      gate?.authorization?.scopeAuthorityAmendmentChangedPaths,
      P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
    ) ||
    !sameJson(
      gate?.authorization?.authorityOwnershipDeltas,
      P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    ) ||
    verification?.scopeAuthorityAmendmentIndependentVerdict !== "PASS" ||
    verification?.scopeAuthorityAmendmentExactHeadChecks !== "PASS" ||
    verification?.scopeAuthorityAmendmentPostMergeChecks !== "PASS" ||
    verification?.transitionEnforcementIndependentVerdict !== "PASS" ||
    verification?.transitionEnforcementExactHeadChecks !== "PASS" ||
    verification?.transitionEnforcementPostMergeChecks !== "PASS" ||
    gate?.claimBoundary?.p1O05Implemented !== false ||
    gate?.claimBoundary?.acceptedAdrChanged !== false ||
    gate?.claimBoundary?.requiredCheckIdentityChanged !== false ||
    gate?.claimBoundary?.alternatePersistenceDriverAuthorized !== false
  ) {
    throw new Error("P1_O05_START_BLOCKED: Issue #53 independent PASS Gate is missing or invalid");
  }
  return {
    ...commits,
    ...trees,
    scopeAuthorityAmendmentExecutionPath: gate.subject.scopeAuthorityAmendmentExecutionPath,
    scopeAuthorityAmendmentEvidencePath: gate.subject.scopeAuthorityAmendmentEvidencePath,
  };
}

export function selectMergeExecutionRecord(changedExecutionRecords, eventBase) {
  const baseMatchingRecords = changedExecutionRecords.filter(
    ({ execution }) => execution.baseCommit === eventBase,
  );
  if (baseMatchingRecords.length > 1) {
    throw new Error(
      `AMBIGUOUS_BASE_MATCHING_CHANGED_EXECUTION_RECORD: ${baseMatchingRecords
        .map(({ path }) => path)
        .join(",")}`,
    );
  }
  if (baseMatchingRecords.length === 1) {
    return baseMatchingRecords[0];
  }
  if (changedExecutionRecords.length > 1) {
    throw new Error(
      `MISSING_BASE_MATCHING_CHANGED_EXECUTION_RECORD: event=${eventBase} changed=${changedExecutionRecords
        .map(({ path }) => path)
        .join(",")}`,
    );
  }
  return changedExecutionRecords[0];
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
    if (!isSafeRepositoryPath(path)) {
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
