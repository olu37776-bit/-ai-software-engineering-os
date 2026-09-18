import { createHash } from "node:crypto";

import { isSafeRepositoryPath } from "./scope-policy.mjs";

export const PHASE2_CHECK = "PHASE2_OPERATION_AWARE_WRITE_SCOPE";
export const PHASE2_OPERATION = "P2-O01";
export const PHASE2_EXECUTION = "operations/phase-2/executions/p2-o01-durable-kernel.json";
export const PHASE2_OPERATION_PATH = "operations/phase-2/operation.json";
export const PHASE2_SCOPE_PATH = "operations/phase-2/write-scope.json";
export const P1_ACCEPTED_HEAD = "ba6dfbc478e75d44f3c33b77aefb5452bc538637";
// Later test-harness-only fixes retain the exact accepted implementation receipt.
export const P1_LANDING_HEAD = "10c475c627bb09091321b4928e1a87b1f6e394dd";
export const P1_ACCEPTED_MAIN = "114f466e4de7cb2f698c2f4cde57fc90006e527f";
export const P1_RECEIPT_HASH = "79a2738ba0f689a8c0bbdea450cb56665957bda1a9f7854fbd14ff489c1dbd55";
export const P1_RECEIPT_PATH = "operations/phase-1/implementation-receipt.json";
export const P1_HUMAN_PATH =
  "operations/phase-1/evidence/o09/p1-v10-human-acceptance-20260909.json";

// This first slice has no authority to modify a frozen contract or Phase 1 record.
// Updating a declaration cannot expand this executable allowlist.
export const PHASE2_EXACT_PATHS = [
  "package.json",
  "pnpm-workspace.yaml",
  "pnpm-lock.yaml",
  "tsconfig.build.json",
  "vitest.config.mjs",
  "tests/architecture/architecture-policy.json",
  "scripts/toolchain/verify-scope.mjs",
  "scripts/toolchain/phase2-scope.mjs",
  "scripts/toolchain/phase2-scope-policy.mjs",
  "scripts/governance/verify_m0.py",
  "scripts/release/assemble-windows-x64.mjs",
  "tests/qualification/packaging/clean-windows-startup.test.mjs",
  "packages/persistence/src/index.ts",
  "packages/persistence/src/persistence-worker.ts",
  "packages/platform/package.json",
  "packages/platform/tsconfig.json",
  "packages/platform/src/index.ts",
  "packages/platform/src/workflow-service.ts",
  "docs/roadmap/progress-status.md",
  PHASE2_OPERATION_PATH,
  PHASE2_SCOPE_PATH,
  PHASE2_EXECUTION,
  "operations/phase-2/verification-plan.json",
  "operations/phase-2/result-format.json",
];

export const PHASE2_PREFIXES = [
  "packages/kernel/",
  "packages/workflow/",
  "scripts/qualification/kernel/",
  "tests/qualification/kernel/",
  "tests/replay/kernel/",
  "tests/fault-injection/kernel/",
  "operations/phase-2/evidence/p2-o01/",
  "docs/implementation/phase-2/",
];

export function phase2PathAllowed(path) {
  return (
    isSafeRepositoryPath(path) &&
    (PHASE2_EXACT_PATHS.includes(path) ||
      PHASE2_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
      /^tests\/qualification\/toolchain\/phase2-[a-z0-9-]+\.test\.mjs$/.test(path) ||
      /^tests\/architecture\/p2-[a-z0-9-]+\.test\.mjs$/.test(path))
  );
}

function requireCondition(condition, code) {
  if (!condition) throw new Error(code);
}

export function lfHash(contents) {
  return createHash("sha256").update(contents.replace(/\r\n/g, "\n")).digest("hex");
}

export function validatePhase2RequiredScripts(basePackage, currentPackage) {
  for (const [name, command] of Object.entries(basePackage.scripts)) {
    const current = currentPackage.scripts?.[name];
    if (name === "quality") {
      requireCondition(
        typeof current === "string" &&
          current
            .split(" && ")
            .filter((step) => step !== "pnpm run kernel:qualify")
            .join(" && ") === command,
        "P2_REQUIRED_QUALITY_WEAKENED",
      );
    } else if (["format", "format:write"].includes(name)) {
      requireCondition(
        typeof current === "string" &&
          current.startsWith(command) &&
          !/[;&|<>\r\n]/.test(current.slice(command.length)),
        "P2_REQUIRED_FORMAT_WEAKENED",
      );
    } else requireCondition(current === command, `P2_REQUIRED_SCRIPT_CHANGED: ${name}`);
  }
  if (currentPackage.scripts?.["kernel:qualify"] !== undefined) {
    requireCondition(
      currentPackage.scripts["kernel:qualify"] ===
        "pnpm run build && node scripts/qualification/kernel/qualify-kernel.mjs",
      "P2_KERNEL_QUALIFICATION_COMMAND_MISMATCH",
    );
  }
}

export function validatePhase2Declarations({ operation, scope, execution }) {
  requireCondition(
    operation?.schemaVersion === "1.0.0" &&
      operation.operationId === PHASE2_OPERATION &&
      operation.acceptedP1Head === P1_ACCEPTED_HEAD &&
      operation.acceptedP1MainCommit === P1_ACCEPTED_MAIN &&
      operation.authorization?.source === "EXPLICIT_USER_CONTINUATION" &&
      operation.authorization?.requiresP1AcceptedMain === true,
    "P2_INVALID_OPERATION_AUTHORIZATION",
  );
  requireCondition(
    scope?.schemaVersion === "1.0.0" &&
      scope.operationId === PHASE2_OPERATION &&
      scope.enforcementMode === "DENY_BY_DEFAULT" &&
      JSON.stringify(scope.exactPaths) === JSON.stringify(PHASE2_EXACT_PATHS) &&
      JSON.stringify(scope.prefixes) === JSON.stringify(PHASE2_PREFIXES),
    "P2_SCOPE_DECLARATION_MISMATCH",
  );
  requireCondition(
    execution?.schemaVersion === "1.0.0" &&
      execution.operationId === PHASE2_OPERATION &&
      execution.implementationBranch === "phase-2/p2-o01-durable-workflow" &&
      /^[0-9a-f]{40}$/.test(execution.baseCommit ?? "") &&
      execution.baseCommit === operation.acceptedP1MainCommit &&
      execution.status === "IN_PROGRESS" &&
      execution.phase2Complete === false,
    "P2_INVALID_EXECUTION_OR_UNLANDED_BASELINE",
  );
}

export function validateAcceptedP1({ receiptText, independent, human }) {
  const receipt = JSON.parse(receiptText);
  requireCondition(lfHash(receiptText) === P1_RECEIPT_HASH, "P2_P1_RECEIPT_NOT_ACCEPTED_SUBJECT");
  requireCondition(
    receipt.implementationDeclaration === "IMPLEMENTED" &&
      receipt.verification?.overallResult === "PASS" &&
      receipt.verification.executions.length === 11 &&
      receipt.verification.executions.every((step) => step.result === "PASS") &&
      receipt.qualificationObligations.length === 5 &&
      receipt.qualificationObligations.every((item) => item.result === "PASS") &&
      receipt.stopCondition?.triggered === false,
    "P2_P1_QUALIFICATION_INCOMPLETE",
  );
  requireCondition(
    independent?.gateDecision === "PASS" &&
      independent.implementationReceiptHash === P1_RECEIPT_HASH &&
      independent.implementationCommit === receipt.implementationCommit &&
      independent.readOnlyVerification === true &&
      independent.remediationPerformed === false &&
      independent.verifiedBy?.actorId !== receipt.declaredBy?.actorId &&
      independent.verifiedBy?.role === "INDEPENDENT_VERIFIER",
    "P2_P1_INDEPENDENT_ACCEPTANCE_MISMATCH",
  );
  requireCondition(
    human?.result === "PASS" &&
      human.reviewKind === "HUMAN_REVIEW" &&
      human.reviewer?.human === true &&
      human.reviewer.actorId === independent.verifiedBy.actorId &&
      human.subject?.implementationCommit === receipt.implementationCommit &&
      human.responseVerbatim === "通过本次 P1 最终验收",
    "P2_P1_HUMAN_ACCEPTANCE_MISSING",
  );
}
