import { createHash } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";

import Ajv2020 from "ajv/dist/2020.js";

import { validateOperationChangedPaths } from "../toolchain/scope-policy.mjs";

export const RESULT_SCHEMA_VERSION = "1.0.0";
export const RESULT_KIND = "Phase1ReceiptVerificationResult";
export const PHASE1_BASELINE_COMMIT = "7700b608586868cc6e4c19d519b8eef6fc770ae3";

const RECEIPT_SCHEMA_PATH = "operations/phase-1/receipt.schema.json";
const INDEPENDENT_SCHEMA_PATH = "operations/phase-1/independent-verification-receipt.schema.json";
const IDENTIFIERS_SCHEMA_PATH = "packages/contracts/schemas/common/identifiers.schema.json";
const AUTHORITY_LOCK_PATH = "operations/phase-1/authority-lock.json";
const VERIFICATION_PLAN_PATH = "operations/phase-1/verification-plan.json";
const WRITE_SCOPE_PATH = "operations/phase-1/write-scope.json";
const OPERATION_MANIFEST_PATH = "operations/phase-1/operation.json";
const VERIFIER_PATH = "scripts/verify-phase-1/verify-receipt.mjs";
const IMPLEMENTATION_RECEIPT_PATH = "operations/phase-1/implementation-receipt.json";
const INDEPENDENT_RECEIPT_PATH =
  "operations/phase-1/evidence/o09/independent-verification-receipt.json";
const TRUSTED_ASSET_PATHS = [
  VERIFIER_PATH,
  "scripts/verify-phase-1/receipt-verifier.mjs",
  "scripts/toolchain/scope-policy.mjs",
  RECEIPT_SCHEMA_PATH,
  INDEPENDENT_SCHEMA_PATH,
  IDENTIFIERS_SCHEMA_PATH,
  AUTHORITY_LOCK_PATH,
  VERIFICATION_PLAN_PATH,
  WRITE_SCOPE_PATH,
  OPERATION_MANIFEST_PATH,
];
const HISTORICAL_GOVERNANCE_AMENDMENT_PATHS = new Set([
  "docs/roadmap/phase-1-write-scope.md",
  AUTHORITY_LOCK_PATH,
  WRITE_SCOPE_PATH,
]);

const REQUIRED_OPERATIONS = Array.from(
  { length: 9 },
  (_, index) => `P1-O${String(index + 1).padStart(2, "0")}`,
);
const REQUIRED_STEPS = [
  "P1-V00-M0-AUTHORIZATION",
  "P1-V01-PREFLIGHT",
  "P1-V02-TOOLCHAIN",
  "P1-V03-CONTRACTS",
  "P1-V04-ARCHITECTURE",
  "P1-V05-POLICY",
  "P1-V06-PERSISTENCE",
  "P1-V07-CONTROL-API",
  "P1-V08-ISOLATION",
  "P1-V09-PACKAGING",
  "P1-V10-INTEGRATED-GATE",
];
const REQUIRED_ADRS = ["ADR-0007", "ADR-0008", "ADR-0009", "ADR-0010", "ADR-0011"];
const STEP_EVIDENCE_LAYOUTS = new Map([
  ["P1-V00-M0-AUTHORIZATION", { kind: "TOP_LEVEL_COMBINED" }],
  ["P1-V01-PREFLIGHT", { kind: "TOP_LEVEL_COMBINED" }],
  ["P1-V02-TOOLCHAIN", { kind: "TOP_LEVEL_COMBINED" }],
  [
    "P1-V03-CONTRACTS",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: [
        "schemaMetaValidation",
        "schemaRegistryValidation",
        "exampleSuite",
        "schemaTypeConsistency",
      ],
    },
  ],
  [
    "P1-V04-ARCHITECTURE",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: ["dependencyGraph", "deepImportDenial", "duplicateSemanticOwnerDenial"],
    },
  ],
  [
    "P1-V05-POLICY",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: ["canonicalizationDeterminism", "failClosedProperties", "mutationQualification"],
    },
  ],
  [
    "P1-V06-PERSISTENCE",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: [
        "persistenceAtomicity",
        "crashRecovery",
        "backupRestore",
        "corruptionQuarantine",
      ],
    },
  ],
  [
    "P1-V07-CONTROL-API",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: [
        "openApiValidation",
        "loopbackExposure",
        "tokenAclRedaction",
        "cliPublicApiAcceptance",
      ],
    },
  ],
  [
    "P1-V08-ISOLATION",
    {
      kind: "NAMED_TOP_LEVEL",
      properties: ["jobObjectLifecycle", "processTreeTermination", "noDowngrade"],
    },
  ],
  ["P1-V09-PACKAGING", { kind: "RESULTS" }],
  ["P1-V10-INTEGRATED-GATE", { kind: "RESULTS" }],
]);
const GIT_RESULT_CACHE = new Map();

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function jsonPointer(error) {
  const pointer = error.instancePath || "/";
  return error.params?.missingProperty
    ? `${pointer === "/" ? "" : pointer}/${error.params.missingProperty}`
    : pointer;
}

function git(repositoryRoot, args, { allowFailure = false, encoding = "utf8" } = {}) {
  const cacheKey = JSON.stringify([resolve(repositoryRoot), args, encoding]);
  if (GIT_RESULT_CACHE.has(cacheKey)) return GIT_RESULT_CACHE.get(cacheKey);
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    if (allowFailure) return undefined;
    throw result.error;
  }
  if (result.status !== 0) {
    if (allowFailure) {
      GIT_RESULT_CACHE.set(cacheKey, undefined);
      return undefined;
    }
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : String(result.stderr ?? "");
    throw new Error(`git ${args[0]} failed (${result.status}): ${stderr.trim()}`);
  }
  GIT_RESULT_CACHE.set(cacheKey, result.stdout);
  return result.stdout;
}

function commitExists(repositoryRoot, commit) {
  return (
    git(repositoryRoot, ["cat-file", "-e", `${commit}^{commit}`], {
      allowFailure: true,
    }) !== undefined
  );
}

function commitContainsPath(repositoryRoot, commit, path) {
  return (
    git(repositoryRoot, ["cat-file", "-e", `${commit}:${path}`], {
      allowFailure: true,
    }) !== undefined
  );
}

function gitObjectBytes(repositoryRoot, commit, path, { allowFailure = false } = {}) {
  return git(repositoryRoot, ["show", `${commit}:${path}`], {
    allowFailure,
    encoding: "buffer",
  });
}

function gitObjectJson(repositoryRoot, commit, path) {
  return JSON.parse(Buffer.from(gitObjectBytes(repositoryRoot, commit, path)).toString("utf8"));
}

function gitObjectId(repositoryRoot, commit, path) {
  return String(git(repositoryRoot, ["rev-parse", `${commit}:${path}`])).trim();
}

function gitCleanObjectId(repositoryRoot, path, bytes) {
  const result = spawnSync("git", ["hash-object", `--path=${path}`, "--stdin"], {
    cwd: repositoryRoot,
    input: bytes,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git hash-object failed (${result.status}): ${String(result.stderr).trim()}`);
  }
  return result.stdout.trim();
}

function deterministicCrlfCheckoutBytes(bytes) {
  const text = Buffer.from(bytes).toString("utf8");
  return Buffer.from(text.replace(/\r\n|\r|\n/gu, "\n").replace(/\n/gu, "\r\n"), "utf8");
}

function isAncestor(repositoryRoot, ancestor, descendant) {
  return (
    git(repositoryRoot, ["merge-base", "--is-ancestor", ancestor, descendant], {
      allowFailure: true,
    }) !== undefined
  );
}

function gitPaths(repositoryRoot, base, head, extra = []) {
  const output = git(
    repositoryRoot,
    ["diff", "--name-only", "--no-renames", "-z", ...extra, base, head],
    { encoding: "buffer" },
  );
  return output.toString("utf8").split("\0").filter(Boolean).sort();
}

function sameStrings(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();
}

function missingValues(values, required) {
  const present = new Set(values);
  return required.filter((value) => !present.has(value));
}

function isSafeRepositoryReference(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !isAbsolute(path) &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path !== "." &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

function isWithin(root, candidate) {
  const result = relative(root, candidate);
  return (
    result === "" || (!result.startsWith(`..${sep}`) && result !== ".." && !isAbsolute(result))
  );
}

async function referenceExists(repositoryRoot, path) {
  if (!isSafeRepositoryReference(path)) return false;
  const candidate = resolve(repositoryRoot, ...path.split("/"));
  try {
    const [actualRoot, actualPath, info] = await Promise.all([
      realpath(repositoryRoot),
      realpath(candidate),
      stat(candidate),
    ]);
    return isWithin(actualRoot, actualPath) && info.isFile();
  } catch {
    return false;
  }
}

async function canonicalTrackedFile(repositoryRoot, suppliedPath, canonicalPath, head) {
  const root = await realpath(repositoryRoot);
  const expected = resolve(root, ...canonicalPath.split("/"));
  const supplied = resolve(suppliedPath);
  if (supplied !== expected) {
    return { passed: false, code: "NON_CANONICAL_RECEIPT_PATH" };
  }
  try {
    const [actual, info, bytes] = await Promise.all([
      realpath(supplied),
      lstat(supplied),
      readFile(supplied),
    ]);
    if (actual !== expected || info.isSymbolicLink() || !info.isFile()) {
      return { passed: false, code: "NON_CANONICAL_RECEIPT_PATH" };
    }
    const committed = gitObjectBytes(repositoryRoot, head, canonicalPath, { allowFailure: true });
    if (!committed || !Buffer.from(committed).equals(bytes)) {
      return { passed: false, code: "RECEIPT_NOT_TRACKED_AT_HEAD" };
    }
    return { passed: true, bytes };
  } catch {
    return { passed: false, code: "NON_CANONICAL_RECEIPT_PATH" };
  }
}

function createCollector(receiptPath) {
  const checks = [];
  const errors = [];
  return {
    addCheck(id, passed, details, failures = []) {
      const check = { id, result: passed ? "PASS" : "FAIL" };
      if (details !== undefined) check.details = details;
      checks.push(check);
      if (!passed) errors.push(...failures);
    },
    result() {
      return {
        schemaVersion: RESULT_SCHEMA_VERSION,
        kind: RESULT_KIND,
        result: errors.length === 0 ? "PASS" : "FAIL",
        receiptPath,
        checks,
        errors,
      };
    },
  };
}

function error(code, message, path) {
  const value = { code, message };
  if (path !== undefined) value.path = path;
  return value;
}

function schemaValidator(schema, identifiers) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat("date-time", {
    type: "string",
    validate(value) {
      return (
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
        !Number.isNaN(Date.parse(value))
      );
    },
  });
  ajv.addKeyword({ keyword: "x-schemaVersion", schemaType: "string", valid: true });
  ajv.addSchema(identifiers);
  return ajv.compile(schema);
}

function validateExactIdentitySet(collector, id, values, required, kind) {
  const safeValues = values.filter((value) => typeof value === "string");
  const duplicates = duplicateValues(safeValues);
  const missing = missingValues(safeValues, required);
  const extras = [...new Set(safeValues.filter((value) => !required.includes(value)))].sort();
  const failures = [];
  for (const value of duplicates) {
    failures.push(error(`DUPLICATE_${kind}`, `Duplicate ${kind.toLowerCase()} ${value}`));
  }
  for (const value of missing) {
    failures.push(error(`MISSING_${kind}`, `Missing ${kind.toLowerCase()} ${value}`));
  }
  for (const value of extras) {
    failures.push(error(`UNEXPECTED_${kind}`, `Unexpected ${kind.toLowerCase()} ${value}`));
  }
  collector.addCheck(
    id,
    failures.length === 0 && safeValues.length === required.length,
    { required, observed: safeValues },
    failures.length > 0
      ? failures
      : [
          error(
            `INVALID_${kind}_COUNT`,
            `Expected exactly ${required.length} ${kind.toLowerCase()}s`,
          ),
        ],
  );
}

async function validateEvidenceReferences(
  collector,
  repositoryRoot,
  head,
  receipt,
  independentReceipt,
) {
  const refs = [];
  const append = (values, source) => {
    if (!Array.isArray(values)) return;
    for (const value of values) refs.push({ source, value });
  };
  append(receipt?.evidenceRefs, "receipt.evidenceRefs");
  for (const execution of receipt?.verification?.executions ?? []) {
    append(execution?.evidenceRefs, `verification.${execution?.stepId ?? "unknown"}`);
  }
  for (const obligation of receipt?.qualificationObligations ?? []) {
    append(obligation?.evidenceRefs, `qualification.${obligation?.adrRef ?? "unknown"}`);
  }
  if (independentReceipt) {
    append(independentReceipt.evidenceRefs, "independent.evidenceRefs");
    for (const step of independentReceipt.stepResults ?? []) {
      append(step?.evidenceRefs, `independent.${step?.stepId ?? "unknown"}`);
    }
  }

  const failures = [];
  for (const ref of refs) {
    const tracked =
      typeof ref.value === "string"
        ? gitObjectBytes(repositoryRoot, head, ref.value, { allowFailure: true })
        : undefined;
    if (
      typeof ref.value !== "string" ||
      !tracked ||
      !(await referenceExists(repositoryRoot, ref.value))
    ) {
      failures.push(
        error(
          "INVALID_EVIDENCE_REF",
          `Evidence reference is unsafe, missing, outside the repository, or not a file (${ref.source})`,
          typeof ref.value === "string" ? ref.value : ref.source,
        ),
      );
    }
  }
  collector.addCheck(
    "evidence-references",
    failures.length === 0,
    { referenceCount: refs.length },
    failures,
  );
}

function evidenceStepId(document) {
  return document?.stepId ?? document?.gateStepId ?? document?.verificationStepId;
}

function appendClaim(claims, value) {
  if (!value || typeof value !== "object" || typeof value.evidenceType !== "string") return;
  for (const type of value.evidenceType.split("+")) {
    if (!claims.has(type)) claims.set(type, []);
    claims.get(type).push(value.result ?? value.status);
  }
}

function collectFormalEvidenceClaims(document, stepId, expectedTypes, failures) {
  const claims = new Map();
  const layout = STEP_EVIDENCE_LAYOUTS.get(stepId);
  if (!layout) {
    failures.push(
      error("UNKNOWN_EVIDENCE_LAYOUT", `No trusted Evidence layout exists for ${stepId}`),
    );
    return claims;
  }
  if (layout.kind === "TOP_LEVEL_COMBINED") {
    appendClaim(claims, document);
  } else if (layout.kind === "NAMED_TOP_LEVEL") {
    for (const property of layout.properties) appendClaim(claims, document?.[property]);
    if (expectedTypes.includes(document?.evidenceType)) {
      failures.push(
        error(
          "UNTRUSTED_EVIDENCE_CLAIM_LOCATION",
          `${stepId} has an expected claim outside its named top-level qualification fields`,
        ),
      );
    }
  } else if (layout.kind === "RESULTS") {
    if (!Array.isArray(document?.results)) {
      failures.push(
        error(
          "MISSING_FORMAL_EVIDENCE_RESULTS",
          `${stepId} Evidence must contain formal results[]`,
        ),
      );
    } else {
      for (const result of document.results) appendClaim(claims, result);
    }
    if (expectedTypes.includes(document?.evidenceType)) {
      failures.push(
        error(
          "UNTRUSTED_EVIDENCE_CLAIM_LOCATION",
          `${stepId} cannot declare an expected result at top level`,
        ),
      );
    }
  }
  return claims;
}

function collectEvidenceCommits(document) {
  const commits = new Set();
  for (const source of [document, document?.subject]) {
    if (!source || typeof source !== "object") continue;
    for (const key of ["qualifiedImplementationCommit", "implementationCommit", "gitCommit"]) {
      const value = source[key];
      if (typeof value === "string" && /^[0-9a-f]{40}$/.test(value)) commits.add(value);
    }
  }
  return commits;
}

function evidenceJsonAtHead(repositoryRoot, head, ref) {
  if (!isSafeRepositoryReference(ref) || !ref.endsWith(".json")) return undefined;
  const bytes = gitObjectBytes(repositoryRoot, head, ref, { allowFailure: true });
  if (!bytes) return undefined;
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch {
    return undefined;
  }
}

function validateStepEvidence(
  collector,
  repositoryRoot,
  head,
  executions,
  verificationPlan,
  checkId,
) {
  const failures = [];
  const documentsByStep = new Map();
  for (const execution of executions ?? []) {
    const documents = [];
    for (const ref of execution?.evidenceRefs ?? []) {
      const document = evidenceJsonAtHead(repositoryRoot, head, ref);
      if (!document) {
        failures.push(
          error("INVALID_EVIDENCE_REF", "Step Evidence must be a HEAD-tracked JSON file", ref),
        );
        continue;
      }
      if (evidenceStepId(document) !== execution.stepId) {
        failures.push(
          error("EVIDENCE_STEP_MISMATCH", `Evidence does not identify ${execution.stepId}`, ref),
        );
      }
      documents.push(document);
    }
    documentsByStep.set(execution?.stepId, documents);
    const expected =
      verificationPlan.steps.find((step) => step.stepId === execution?.stepId)
        ?.expectedEvidenceTypes ?? [];
    const claims = new Map();
    for (const document of documents) {
      for (const [type, results] of collectFormalEvidenceClaims(
        document,
        execution?.stepId,
        expected,
        failures,
      )) {
        if (!claims.has(type)) claims.set(type, []);
        claims.get(type).push(...results);
      }
    }
    for (const type of expected) {
      const results = claims.get(type) ?? [];
      if (results.length === 0) {
        failures.push(
          error("EVIDENCE_TYPE_OR_RESULT_MISMATCH", `${execution?.stepId} lacks PASS ${type}`),
        );
        continue;
      }
      if (results.length !== 1) {
        failures.push(
          error(
            "DUPLICATE_EVIDENCE_CLAIM",
            `${execution?.stepId} has ${results.length} authoritative claims for ${type}; exactly one is required`,
          ),
        );
      }
      if (results.some((result) => result !== "PASS")) {
        failures.push(
          error(
            "NON_PASS_EVIDENCE_CLAIM",
            `${execution?.stepId} contains a non-PASS claim for ${type}`,
          ),
        );
      }
    }
  }
  collector.addCheck(checkId, failures.length === 0, undefined, failures);
  return documentsByStep;
}

function validateOperationOutputsAndEvidence(
  collector,
  repositoryRoot,
  receipt,
  operationManifest,
  documentsByStep,
) {
  const failures = [];
  const operationSteps = new Map([
    ["P1-O01", REQUIRED_STEPS.slice(0, 3)],
    ...REQUIRED_OPERATIONS.slice(1).map((operationId, index) => [
      operationId,
      [REQUIRED_STEPS[index + 3]],
    ]),
  ]);
  for (const operation of receipt?.suboperations ?? []) {
    const frozen = operationManifest.suboperations.find(
      (item) => item.operationId === operation?.operationId,
    );
    const observedOutputs = Array.isArray(operation?.outputs) ? [...operation.outputs].sort() : [];
    const expectedOutputs = Array.isArray(frozen?.outputs) ? [...frozen.outputs].sort() : [];
    if (!sameStrings(observedOutputs, expectedOutputs)) {
      failures.push(
        error(
          "OPERATION_OUTPUT_MISMATCH",
          `${operation?.operationId} outputs differ from frozen operation.json`,
        ),
      );
    }
    const evidenceCommits = new Set();
    for (const stepId of operationSteps.get(operation?.operationId) ?? []) {
      for (const document of documentsByStep.get(stepId) ?? []) {
        for (const commit of collectEvidenceCommits(document)) evidenceCommits.add(commit);
      }
    }
    const expectedCommitRefs = [...evidenceCommits].sort();
    const observedCommitRefs = Array.isArray(operation?.commitRefs)
      ? [...operation.commitRefs].sort()
      : [];
    const duplicateCommitRefs = duplicateValues(observedCommitRefs);
    if (duplicateCommitRefs.length > 0) {
      failures.push(
        error(
          "DUPLICATE_OPERATION_COMMIT_REF",
          `${operation?.operationId} contains duplicate commitRefs: ${duplicateCommitRefs.join(", ")}`,
        ),
      );
    }
    for (const ref of expectedCommitRefs) {
      if (
        !commitExists(repositoryRoot, ref) ||
        !isAncestor(repositoryRoot, PHASE1_BASELINE_COMMIT, ref) ||
        !isAncestor(repositoryRoot, ref, receipt.implementationCommit)
      ) {
        failures.push(
          error(
            "EVIDENCE_QUALIFIED_COMMIT_INVALID",
            `${operation?.operationId} Evidence identifies an invalid qualified commit`,
            ref,
          ),
        );
      }
    }
    if (!sameStrings(observedCommitRefs, expectedCommitRefs)) {
      failures.push(
        error(
          "OPERATION_COMMIT_REF_EVIDENCE_MISMATCH",
          `${operation?.operationId} commitRefs must exactly equal the qualified commit set from its step Evidence`,
        ),
      );
    }
  }
  collector.addCheck(
    "operation-outputs-and-qualified-commits",
    failures.length === 0,
    undefined,
    failures,
  );
}

function validateCommitReferences(collector, repositoryRoot, receipt) {
  const refs = [];
  for (const operation of receipt?.suboperations ?? []) {
    for (const ref of operation?.commitRefs ?? [])
      refs.push({ operationId: operation.operationId, ref });
  }
  const failures = [];
  for (const { operationId, ref } of refs) {
    if (typeof ref !== "string" || !commitExists(repositoryRoot, ref)) {
      failures.push(
        error(
          "INVALID_COMMIT_REF",
          `Commit reference for ${operationId ?? "unknown"} does not resolve`,
          String(ref),
        ),
      );
    } else if (
      typeof receipt?.implementationCommit !== "string" ||
      !commitExists(repositoryRoot, receipt.implementationCommit) ||
      !isAncestor(repositoryRoot, PHASE1_BASELINE_COMMIT, ref) ||
      !isAncestor(repositoryRoot, ref, receipt.implementationCommit)
    ) {
      failures.push(
        error(
          "INVALID_COMMIT_REF",
          `Commit reference for ${operationId ?? "unknown"} is not reachable from implementationCommit`,
          ref,
        ),
      );
    }
  }
  collector.addCheck(
    "commit-references",
    failures.length === 0,
    { referenceCount: refs.length },
    failures,
  );
}

function validatePassSemantics(collector, receipt) {
  const failures = [];
  if (receipt?.implementationDeclaration !== "IMPLEMENTED") {
    failures.push(
      error(
        receipt?.implementationDeclaration === "VERIFIED"
          ? "IMPLEMENTATION_AGENT_CANNOT_DECLARE_VERIFIED"
          : "IMPLEMENTATION_NOT_COMPLETE",
        "Implementation receipt must declare IMPLEMENTED and can never declare VERIFIED",
        "/implementationDeclaration",
      ),
    );
  }
  for (const operation of receipt?.suboperations ?? []) {
    if (operation?.status !== "IMPLEMENTED") {
      failures.push(
        error(
          "NON_IMPLEMENTED_OPERATION",
          `${operation?.operationId ?? "Unknown operation"} is not IMPLEMENTED`,
        ),
      );
    }
  }
  for (const execution of receipt?.verification?.executions ?? []) {
    if (execution?.result !== "PASS") {
      failures.push(
        error("NON_PASS_RESULT", `${execution?.stepId ?? "Unknown verification step"} is not PASS`),
      );
    }
  }
  if (receipt?.verification?.overallResult !== "PASS") {
    failures.push(error("NON_PASS_OVERALL_RESULT", "Verification overallResult must be PASS"));
  }
  for (const obligation of receipt?.qualificationObligations ?? []) {
    if (obligation?.result !== "PASS") {
      failures.push(
        error(
          "NON_PASS_ADR_OBLIGATION",
          `${obligation?.adrRef ?? "Unknown ADR obligation"} is not PASS`,
        ),
      );
    }
  }
  if (receipt?.stopCondition?.triggered !== false) {
    failures.push(error("STOP_CONDITION_TRIGGERED", "stopCondition.triggered must be false"));
  }
  if (receipt?.unauthorizedFallbackUsed !== false) {
    failures.push(error("UNAUTHORIZED_FALLBACK", "unauthorizedFallbackUsed must be false"));
  }
  if (receipt?.documentationSynchronized !== true) {
    failures.push(
      error("DOCUMENTATION_NOT_SYNCHRONIZED", "documentationSynchronized must be true"),
    );
  }
  if (
    receipt?.writeScope?.authorityLockVerified !== true ||
    receipt?.writeScope?.compliant !== true ||
    !Array.isArray(receipt?.writeScope?.violations) ||
    receipt.writeScope.violations.length !== 0
  ) {
    failures.push(
      error(
        "WRITE_SCOPE_VIOLATION",
        "Receipt write scope must be verified, compliant, and violation-free",
      ),
    );
  }
  collector.addCheck("implemented-pass-semantics", failures.length === 0, undefined, failures);
}

async function validateTrustedAssets(collector, repositoryRoot, implementationCommit) {
  const failures = [];
  const canonicalRoot = await realpath(repositoryRoot);
  for (const path of TRUSTED_ASSET_PATHS) {
    const trusted = gitObjectBytes(repositoryRoot, implementationCommit, path, {
      allowFailure: true,
    });
    if (!trusted) {
      failures.push(
        error(
          "TRUST_ASSET_MISSING_AT_IMPLEMENTATION",
          "Trust asset is absent from implementation commit",
          path,
        ),
      );
      continue;
    }
    try {
      const fullPath = resolve(repositoryRoot, ...path.split("/"));
      const [info, actual, worktreeBytes] = await Promise.all([
        lstat(fullPath),
        realpath(fullPath),
        readFile(fullPath),
      ]);
      const expected = resolve(canonicalRoot, ...path.split("/"));
      if (info.isSymbolicLink() || actual !== expected) {
        failures.push(
          error("TRUST_ASSET_SYMLINK", "Trust asset must be a canonical regular file", path),
        );
      }
      const trustedObjectId = gitObjectId(repositoryRoot, implementationCommit, path);
      const worktreeObjectId = gitCleanObjectId(repositoryRoot, path, worktreeBytes);
      if (worktreeObjectId !== trustedObjectId) {
        failures.push(
          error(
            "TRUST_ASSET_WORKTREE_DRIFT",
            "Git-cleaned worktree trust asset differs from implementation commit A",
            path,
          ),
        );
      }
    } catch {
      failures.push(
        error("TRUST_ASSET_WORKTREE_DRIFT", "Cannot read canonical worktree trust asset", path),
      );
    }
  }
  collector.addCheck(
    "implementation-trust-assets",
    failures.length === 0,
    { paths: TRUSTED_ASSET_PATHS },
    failures,
  );
}

async function validateAuthorityBindings(collector, receipt, lockBytes, planBytes) {
  const lockHash = sha256(lockBytes);
  // The frozen Phase 1 authority recorded the verification-plan digest over its
  // deterministic CRLF checkout representation. Derive that representation from
  // the immutable implementation-commit blob so the result is identical on
  // Windows and POSIX hosts and never depends on mutable worktree bytes.
  const planHash = sha256(deterministicCrlfCheckoutBytes(planBytes));
  const lockPassed = receipt?.authorityLockHash === lockHash;
  collector.addCheck(
    "authority-lock-raw-sha256",
    lockPassed,
    { actualSha256: lockHash },
    lockPassed
      ? []
      : [
          error(
            "AUTHORITY_LOCK_HASH_MISMATCH",
            "authorityLockHash does not match exact authority-lock.json bytes",
          ),
        ],
  );
  const planPassed = receipt?.verification?.planHash === planHash;
  collector.addCheck(
    "verification-plan-raw-sha256",
    planPassed,
    { actualSha256: planHash },
    planPassed
      ? []
      : [
          error(
            "VERIFICATION_PLAN_HASH_MISMATCH",
            "verification.planHash does not match the deterministic checkout bytes derived from the implementation commit",
          ),
        ],
  );
  const plan = JSON.parse(planBytes.toString("utf8"));
  const planIdPassed = receipt?.verification?.planId === plan.planId;
  collector.addCheck(
    "verification-plan-id",
    planIdPassed,
    { expected: plan.planId, observed: receipt?.verification?.planId },
    planIdPassed
      ? []
      : [
          error(
            "VERIFICATION_PLAN_ID_MISMATCH",
            "verification.planId does not match the frozen plan",
          ),
        ],
  );
}

async function validateCommitBinding(
  collector,
  repositoryRoot,
  receipt,
  receiptPath,
  receiptBytes,
  independentReceiptPath,
) {
  const implementationCommit = receipt?.implementationCommit;
  const baselinePassed = receipt?.baselineCommit === PHASE1_BASELINE_COMMIT;
  collector.addCheck(
    "fixed-baseline",
    baselinePassed,
    { expected: PHASE1_BASELINE_COMMIT, observed: receipt?.baselineCommit },
    baselinePassed
      ? []
      : [error("BASELINE_COMMIT_MISMATCH", `baselineCommit must be ${PHASE1_BASELINE_COMMIT}`)],
  );

  const head = String(git(repositoryRoot, ["rev-parse", "HEAD"])).trim();
  const resolvable =
    typeof implementationCommit === "string" && commitExists(repositoryRoot, implementationCommit);
  const failures = [];
  const worktreeStatus = String(
    git(repositoryRoot, ["status", "--porcelain", "--untracked-files=all"]),
  ).trim();
  if (worktreeStatus !== "") {
    failures.push(
      error("WORKTREE_NOT_CLEAN", "Independent receipt verification requires a clean worktree"),
    );
  }
  if (!resolvable) {
    failures.push(
      error("INVALID_IMPLEMENTATION_COMMIT", "implementationCommit does not resolve to a commit"),
    );
  } else {
    if (!commitExists(repositoryRoot, PHASE1_BASELINE_COMMIT)) {
      failures.push(
        error(
          "INVALID_BASELINE_COMMIT",
          "The fixed Phase 1 baseline is not available in this checkout",
        ),
      );
    } else if (!isAncestor(repositoryRoot, PHASE1_BASELINE_COMMIT, implementationCommit)) {
      failures.push(
        error(
          "IMPLEMENTATION_COMMIT_BINDING",
          "implementationCommit is not descended from the fixed baseline",
        ),
      );
    }
    const parents = String(git(repositoryRoot, ["rev-list", "--parents", "-n", "1", head]))
      .trim()
      .split(/\s+/);
    if (parents.length !== 2 || parents[1] !== implementationCommit) {
      failures.push(
        error(
          "IMPLEMENTATION_COMMIT_BINDING",
          "HEAD must be receipt commit B with implementation commit A as its single direct parent",
        ),
      );
    }
    if (!commitContainsPath(repositoryRoot, implementationCommit, VERIFIER_PATH)) {
      failures.push(
        error(
          "IMPLEMENTATION_COMMIT_BINDING",
          `implementationCommit must contain the read-only verifier at ${VERIFIER_PATH}`,
        ),
      );
    }
    if (commitContainsPath(repositoryRoot, implementationCommit, IMPLEMENTATION_RECEIPT_PATH)) {
      failures.push(
        error(
          "IMPLEMENTATION_COMMIT_SELF_REFERENCE",
          `Implementation commit A must not contain ${IMPLEMENTATION_RECEIPT_PATH}; receipt belongs to commit B`,
        ),
      );
    }
    const prematureEvidence = String(
      git(repositoryRoot, [
        "ls-tree",
        "-r",
        "--name-only",
        implementationCommit,
        "operations/phase-1/evidence/o09",
        "operations/phase-1/executions",
      ]),
    )
      .split(/\r?\n/)
      .filter(
        (path) =>
          path.startsWith("operations/phase-1/evidence/o09/") ||
          /^operations\/phase-1\/executions\/p1-o09-[^/]+\.json$/.test(path),
      );
    if (prematureEvidence.length > 0) {
      failures.push(
        error(
          "IMPLEMENTATION_COMMIT_SELF_REFERENCE",
          "Implementation commit A must not contain O09 receipt Evidence or execution records",
        ),
      );
    }
  }

  const canonicalReceipt = await canonicalTrackedFile(
    repositoryRoot,
    receiptPath,
    IMPLEMENTATION_RECEIPT_PATH,
    head,
  );
  if (!canonicalReceipt.passed || !canonicalReceipt.bytes.equals(receiptBytes)) {
    failures.push(
      error(
        canonicalReceipt.code ?? "RECEIPT_NOT_TRACKED_AT_HEAD",
        "Implementation receipt must be the canonical, non-symlink, exact HEAD-tracked file",
        IMPLEMENTATION_RECEIPT_PATH,
      ),
    );
  }
  if (independentReceiptPath) {
    const canonicalIndependent = await canonicalTrackedFile(
      repositoryRoot,
      independentReceiptPath,
      INDEPENDENT_RECEIPT_PATH,
      head,
    );
    if (!canonicalIndependent.passed) {
      failures.push(
        error(
          canonicalIndependent.code,
          "Independent receipt must be the canonical, non-symlink, exact HEAD-tracked file",
          INDEPENDENT_RECEIPT_PATH,
        ),
      );
    }
  }
  if (resolvable) {
    const bPaths = gitPaths(repositoryRoot, implementationCommit, head);
    for (const path of bPaths.filter((candidate) => TRUSTED_ASSET_PATHS.includes(candidate))) {
      failures.push(
        error(
          "TRUST_ASSET_HEAD_DRIFT",
          "Receipt commit B changed a trust asset from implementation commit A",
          path,
        ),
      );
    }
    const allowed = bPaths.every(
      (path) =>
        path === IMPLEMENTATION_RECEIPT_PATH ||
        /^operations\/phase-1\/evidence\/o09\/[^/]+\.json$/.test(path) ||
        /^operations\/phase-1\/executions\/p1-o09-[^/]+\.json$/.test(path),
    );
    if (!allowed) {
      failures.push(
        error(
          "RECEIPT_COMMIT_SCOPE_VIOLATION",
          "Receipt commit B contains paths outside receipt, O09 evidence, or O09 execution records",
        ),
      );
    }
  }
  collector.addCheck(
    "two-commit-implementation-binding",
    failures.length === 0,
    { head, implementationCommit },
    failures,
  );
}

async function validateWriteScope(collector, repositoryRoot, receipt, writeScope, authorityLock) {
  const implementationCommit = receipt?.implementationCommit;
  if (
    !commitExists(repositoryRoot, PHASE1_BASELINE_COMMIT) ||
    !commitExists(repositoryRoot, implementationCommit)
  ) {
    collector.addCheck("write-scope-exact-git-diff", false, undefined, [
      error(
        "WRITE_SCOPE_VIOLATION",
        "Cannot compute exact write scope because a binding commit is invalid",
      ),
    ]);
    return;
  }
  const changed = gitPaths(repositoryRoot, PHASE1_BASELINE_COMMIT, implementationCommit);
  const generated = gitPaths(repositoryRoot, PHASE1_BASELINE_COMMIT, implementationCommit, [
    "--diff-filter=A",
  ]);
  const recordedChanged = Array.isArray(receipt?.writeScope?.changedPaths)
    ? [...receipt.writeScope.changedPaths].sort()
    : [];
  const recordedGenerated = Array.isArray(receipt?.writeScope?.generatedPaths)
    ? [...receipt.writeScope.generatedPaths].sort()
    : [];
  const failures = [];
  if (!sameStrings(recordedChanged, changed)) {
    failures.push(
      error(
        "WRITE_SCOPE_VIOLATION",
        "writeScope.changedPaths does not equal the exact baseline..implementation Git diff",
      ),
    );
  }
  if (!sameStrings(recordedGenerated, generated)) {
    failures.push(
      error(
        "WRITE_SCOPE_VIOLATION",
        "writeScope.generatedPaths does not equal exact added paths in the Git diff",
      ),
    );
  }
  const uncovered = [];
  for (const path of changed) {
    // These three authority documents were deliberately changed by the recorded
    // P1-O01 governance-amendment flow. Current operation scopes describe the
    // final state, so replaying them cannot represent those historical grants.
    if (HISTORICAL_GOVERNANCE_AMENDMENT_PATHS.has(path)) continue;
    const covered = REQUIRED_OPERATIONS.some(
      (operationId) =>
        validateOperationChangedPaths([path], operationId, writeScope, authorityLock).length === 0,
    );
    if (!covered) uncovered.push(path);
  }
  for (const path of uncovered) {
    failures.push(
      error(
        "WRITE_SCOPE_VIOLATION",
        "Changed path is not authorized by any Phase 1 operation",
        path,
      ),
    );
  }
  collector.addCheck(
    "write-scope-exact-git-diff",
    failures.length === 0,
    { changedPathCount: changed.length, generatedPathCount: generated.length },
    failures,
  );
}

async function validateIndependentReceipt(
  collector,
  repositoryRoot,
  receipt,
  receiptBytes,
  independentReceipt,
  independentSchema,
  identifiersSchema,
) {
  if (!independentReceipt) {
    if (
      receipt?.independentVerificationRef !== null &&
      receipt?.independentVerificationRef !== undefined
    ) {
      collector.addCheck("independent-receipt-link", false, undefined, [
        error(
          "INDEPENDENT_RECEIPT_REQUIRED",
          "Receipt declares independentVerificationRef but --independent-receipt was not supplied",
        ),
      ]);
    }
    return;
  }
  const linkPassed = receipt?.independentVerificationRef === INDEPENDENT_RECEIPT_PATH;
  collector.addCheck(
    "independent-receipt-link",
    linkPassed,
    { expected: INDEPENDENT_RECEIPT_PATH, observed: receipt?.independentVerificationRef },
    linkPassed
      ? []
      : [
          error(
            "NON_CANONICAL_INDEPENDENT_RECEIPT_REF",
            "independentVerificationRef must name the canonical independent receipt",
          ),
        ],
  );
  const validate = schemaValidator(independentSchema, identifiersSchema);
  const schemaPassed = validate(independentReceipt);
  collector.addCheck(
    "independent-receipt-schema",
    schemaPassed,
    undefined,
    schemaPassed
      ? []
      : (validate.errors ?? []).map((item) =>
          error(
            "INDEPENDENT_SCHEMA_VALIDATION_FAILED",
            item.message ?? "Schema validation failed",
            jsonPointer(item),
          ),
        ),
  );

  const stepIds = (independentReceipt?.stepResults ?? []).map((item) => item?.stepId);
  validateExactIdentitySet(
    collector,
    "independent-exact-verification-steps",
    stepIds,
    REQUIRED_STEPS,
    "VERIFICATION_STEP",
  );
  const failures = [];
  if (independentReceipt?.verifiedBy?.role !== "INDEPENDENT_VERIFIER") {
    failures.push(
      error(
        "NON_INDEPENDENT_VERIFIER",
        "Independent receipt must be issued by INDEPENDENT_VERIFIER",
      ),
    );
  }
  if (independentReceipt?.verifiedBy?.actorId === receipt?.declaredBy?.actorId) {
    failures.push(
      error(
        "NON_INDEPENDENT_VERIFIER",
        "Independent verifier actor must differ from implementation actor",
      ),
    );
  }
  if (
    independentReceipt?.readOnlyVerification !== true ||
    independentReceipt?.remediationPerformed !== false
  ) {
    failures.push(
      error(
        "NON_READ_ONLY_VERIFICATION",
        "Independent verification must be read-only with no remediation",
      ),
    );
  }
  if (independentReceipt?.implementationCommit !== receipt?.implementationCommit) {
    failures.push(
      error(
        "INDEPENDENT_IMPLEMENTATION_BINDING",
        "Independent receipt implementationCommit differs",
      ),
    );
  }
  if (independentReceipt?.implementationReceiptHash !== sha256(receiptBytes)) {
    failures.push(
      error(
        "INDEPENDENT_RECEIPT_HASH_MISMATCH",
        "Independent receipt does not bind exact implementation receipt bytes",
      ),
    );
  }
  if (independentReceipt?.gateDecision !== "PASS") {
    failures.push(error("INDEPENDENT_GATE_NOT_PASS", "Independent gateDecision must be PASS"));
  }
  for (const step of independentReceipt?.stepResults ?? []) {
    if (step?.result !== "PASS") {
      failures.push(
        error("NON_PASS_RESULT", `${step?.stepId ?? "Unknown independent step"} is not PASS`),
      );
    }
  }
  collector.addCheck("independent-read-only-gate", failures.length === 0, undefined, failures);
}

export async function verifyPhase1Receipt({
  repositoryRoot,
  receiptPath,
  independentReceiptPath,
  executingVerifierPath,
}) {
  GIT_RESULT_CACHE.clear();
  const root = resolve(repositoryRoot);
  const head = String(git(root, ["rev-parse", "HEAD"])).trim();
  const absoluteReceiptPath = resolve(receiptPath);
  const collector = createCollector(absoluteReceiptPath);
  const expectedEntrypoint = resolve(root, ...VERIFIER_PATH.split("/"));
  let canonicalEntrypoint;
  try {
    const info = await lstat(executingVerifierPath);
    canonicalEntrypoint =
      resolve(executingVerifierPath) === expectedEntrypoint &&
      (await realpath(executingVerifierPath)) === expectedEntrypoint &&
      info.isFile() &&
      !info.isSymbolicLink();
  } catch {
    canonicalEntrypoint = false;
  }
  if (!canonicalEntrypoint) {
    collector.addCheck("canonical-verifier-entrypoint", false, undefined, [
      error(
        "NON_CANONICAL_VERIFIER_ENTRYPOINT",
        "Verifier must execute from the canonical repository path",
        VERIFIER_PATH,
      ),
    ]);
    return collector.result();
  }
  const canonicalReceipt = await canonicalTrackedFile(
    root,
    absoluteReceiptPath,
    IMPLEMENTATION_RECEIPT_PATH,
    head,
  );
  if (!canonicalReceipt.passed) {
    collector.addCheck("canonical-implementation-receipt", false, undefined, [
      error(
        canonicalReceipt.code,
        "--receipt must identify the canonical, non-symlink, exact HEAD-tracked implementation receipt",
        IMPLEMENTATION_RECEIPT_PATH,
      ),
    ]);
    return collector.result();
  }
  const receiptBytes = canonicalReceipt.bytes;
  let receipt;
  try {
    receipt = JSON.parse(receiptBytes.toString("utf8"));
  } catch (cause) {
    collector.addCheck("implementation-receipt-json", false, undefined, [
      error(
        "INVALID_JSON",
        `Cannot read implementation receipt JSON: ${cause.message}`,
        absoluteReceiptPath,
      ),
    ]);
    return collector.result();
  }

  let independentReceiptBytes;
  let independentReceipt;
  if (independentReceiptPath) {
    const canonicalIndependent = await canonicalTrackedFile(
      root,
      resolve(independentReceiptPath),
      INDEPENDENT_RECEIPT_PATH,
      head,
    );
    if (!canonicalIndependent.passed) {
      collector.addCheck("canonical-independent-receipt", false, undefined, [
        error(
          canonicalIndependent.code,
          "--independent-receipt must identify the canonical, non-symlink, exact HEAD-tracked independent receipt",
          INDEPENDENT_RECEIPT_PATH,
        ),
      ]);
    } else {
      independentReceiptBytes = canonicalIndependent.bytes;
      try {
        independentReceipt = JSON.parse(independentReceiptBytes.toString("utf8"));
      } catch (cause) {
        collector.addCheck("independent-receipt-json", false, undefined, [
          error(
            "INVALID_INDEPENDENT_JSON",
            `Cannot read independent receipt JSON: ${cause.message}`,
          ),
        ]);
      }
    }
  }

  await validateCommitBinding(
    collector,
    root,
    receipt,
    absoluteReceiptPath,
    receiptBytes,
    independentReceiptPath ? resolve(independentReceiptPath) : undefined,
  );
  const implementationCommit = receipt?.implementationCommit;
  if (typeof implementationCommit !== "string" || !commitExists(root, implementationCommit)) {
    return collector.result();
  }
  await validateTrustedAssets(collector, root, implementationCommit);

  const receiptSchemaBytes = gitObjectBytes(root, implementationCommit, RECEIPT_SCHEMA_PATH);
  const independentSchemaBytes = gitObjectBytes(
    root,
    implementationCommit,
    INDEPENDENT_SCHEMA_PATH,
  );
  const identifiersSchemaBytes = gitObjectBytes(
    root,
    implementationCommit,
    IDENTIFIERS_SCHEMA_PATH,
  );
  const lockBytes = gitObjectBytes(root, implementationCommit, AUTHORITY_LOCK_PATH);
  const planBytes = gitObjectBytes(root, implementationCommit, VERIFICATION_PLAN_PATH);
  const receiptSchema = JSON.parse(Buffer.from(receiptSchemaBytes).toString("utf8"));
  const independentSchema = JSON.parse(Buffer.from(independentSchemaBytes).toString("utf8"));
  const identifiersSchema = JSON.parse(Buffer.from(identifiersSchemaBytes).toString("utf8"));
  const authorityLock = JSON.parse(Buffer.from(lockBytes).toString("utf8"));
  const verificationPlan = JSON.parse(Buffer.from(planBytes).toString("utf8"));
  const writeScope = gitObjectJson(root, implementationCommit, WRITE_SCOPE_PATH);
  const operationManifest = gitObjectJson(root, implementationCommit, OPERATION_MANIFEST_PATH);
  const validateReceipt = schemaValidator(receiptSchema, identifiersSchema);
  const receiptSchemaPassed = validateReceipt(receipt);
  collector.addCheck(
    "implementation-receipt-schema-1.1.0",
    receiptSchemaPassed,
    undefined,
    receiptSchemaPassed
      ? []
      : (validateReceipt.errors ?? []).map((item) =>
          error(
            "RECEIPT_SCHEMA_VALIDATION_FAILED",
            item.message ?? "Schema validation failed",
            jsonPointer(item),
          ),
        ),
  );

  const operationIds = (receipt?.suboperations ?? []).map((item) => item?.operationId);
  const stepIds = (receipt?.verification?.executions ?? []).map((item) => item?.stepId);
  const adrIds = (receipt?.qualificationObligations ?? []).map((item) => item?.adrRef);
  validateExactIdentitySet(
    collector,
    "exact-suboperations",
    operationIds,
    REQUIRED_OPERATIONS,
    "OPERATION",
  );
  validateExactIdentitySet(
    collector,
    "exact-verification-steps",
    stepIds,
    REQUIRED_STEPS,
    "VERIFICATION_STEP",
  );
  validateExactIdentitySet(
    collector,
    "exact-adr-obligations",
    adrIds,
    REQUIRED_ADRS,
    "ADR_OBLIGATION",
  );
  validatePassSemantics(collector, receipt);
  await validateAuthorityBindings(
    collector,
    receipt,
    Buffer.from(lockBytes),
    Buffer.from(planBytes),
  );
  await validateWriteScope(collector, root, receipt, writeScope, authorityLock);
  validateCommitReferences(collector, root, receipt);
  const documentsByStep = validateStepEvidence(
    collector,
    root,
    head,
    receipt?.verification?.executions,
    verificationPlan,
    "implementation-step-evidence-semantics",
  );
  validateOperationOutputsAndEvidence(collector, root, receipt, operationManifest, documentsByStep);
  await validateIndependentReceipt(
    collector,
    root,
    receipt,
    receiptBytes,
    independentReceipt,
    independentSchema,
    identifiersSchema,
  );
  if (independentReceipt) {
    validateStepEvidence(
      collector,
      root,
      head,
      independentReceipt.stepResults,
      verificationPlan,
      "independent-step-evidence-semantics",
    );
  }
  await validateEvidenceReferences(collector, root, head, receipt, independentReceipt);
  return collector.result();
}
