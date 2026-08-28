const OPERATION_ID_PATTERN = /^P1-O0[1-9]$/;
const EXECUTION_PATH_PATTERN = /^operations\/phase-1\/executions\/p1-o(0[1-9])-[^/]+\.json$/;
const EVIDENCE_PATH_PATTERN = /^operations\/phase-1\/evidence\/o(0[1-9])\/[^/].*$/;

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
