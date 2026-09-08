import { isDeepStrictEqual } from "node:util";

import { isSafeRepositoryPath } from "./scope-policy.mjs";
import { lfHash } from "./phase2-scope-policy.mjs";

export const P2_O02_ID = "P2-O02";
export const P2_O02_BRANCH = "phase-2/p2-o02-atomic-results";
// Exact protected-main merge of qualified PR #102; mutable records cannot replace it.
export const P2_O01_ACCEPTED_MAIN = "449b740cdaf45e822ccc8e5fb256d5960fdbf206";
export const P2_O02_OPERATION = "operations/phase-2/o02/operation.json";
export const P2_O02_SCOPE = "operations/phase-2/o02/write-scope.json";
export const P2_O02_EXECUTION = "operations/phase-2/executions/p2-o02-atomic-results.json";
export const RESULT_SCHEMA_ID = "urn:aseos:schema:result-journal-append-batch:1.0.0";
export const RESULT_SCHEMA_PATH =
  "packages/contracts/schemas/persistence/result-journal-append-batch.schema.json";
export const RESULT_CONTRACT_ID = "aseos.persistence.result-journal-append-batch";
export const RESULT_EXAMPLES = [
  "packages/contracts/examples/persistence/valid/result-journal-append-batch.json",
  "packages/contracts/examples/persistence/valid/result-journal-scheduled-batch.json",
  "packages/contracts/examples/persistence/invalid/result-journal-missing-result.json",
];
export const P2_O02_ADDITIVE_AUTHORITY = [
  "packages/contracts/schema-registry.json",
  "packages/contracts/schema-inventory.json",
  "packages/contracts/examples/first-slice/example-suite.json",
];
export const P2_O02_EXACT_PATHS = [
  "package.json",
  "scripts/governance/verify_m0.py",
  "scripts/toolchain/phase2-scope.mjs",
  "scripts/toolchain/phase2-scope-o02.mjs",
  "scripts/toolchain/phase2-scope-o02-policy.mjs",
  P2_O02_OPERATION,
  P2_O02_SCOPE,
  P2_O02_EXECUTION,
  "operations/phase-2/o02/verification-plan.json",
  "operations/phase-2/o02/result-format.json",
  RESULT_SCHEMA_PATH,
  ...P2_O02_ADDITIVE_AUTHORITY,
  "packages/contracts/type-bindings.json",
  "packages/contracts/src/types.generated.ts",
  ...RESULT_EXAMPLES,
  "tests/contract/persistence/p2-result-journal-contract.test.mjs",
  "tests/contract/example-suite.test.mjs",
  "tests/qualification/packaging/clean-windows-startup.test.mjs",
  "packages/persistence/src/persistence-worker.ts",
  "packages/persistence/src/index.ts",
  "scripts/qualification/persistence/qualify-result-journal.mjs",
  "docs/implementation/phase-2/p2-o02-atomic-results.md",
  "docs/roadmap/progress-status.md",
];
export const P2_O02_PREFIXES = [
  "tests/qualification/persistence/p2-",
  "tests/fault-injection/persistence/p2-",
  "scripts/qualification/persistence/p2-",
  "operations/phase-2/evidence/p2-o02/",
  "docs/implementation/phase-2/o02/",
];

export function p2O02PathAllowed(path) {
  return (
    isSafeRepositoryPath(path) &&
    (P2_O02_EXACT_PATHS.includes(path) ||
      P2_O02_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
      /^tests\/qualification\/toolchain\/phase2-o02-[a-z0-9-]+\.test\.mjs$/.test(path))
  );
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateP2O02Declarations(operation, scope, execution) {
  requireCondition(
    /^[0-9a-f]{40}$/.test(P2_O01_ACCEPTED_MAIN ?? "") &&
      operation?.schemaVersion === "1.0.0" &&
      operation.operationId === P2_O02_ID &&
      operation.acceptedO01MainCommit === P2_O01_ACCEPTED_MAIN &&
      operation.authorization?.source === "EXPLICIT_USER_CONTINUATION" &&
      operation.authorization?.contractMutation === "SINGLE_ADDITIVE_RESULT_JOURNAL_CONTRACT" &&
      execution?.schemaVersion === "1.0.0" &&
      execution.operationId === P2_O02_ID &&
      execution.implementationBranch === P2_O02_BRANCH &&
      execution.baseCommit === P2_O01_ACCEPTED_MAIN &&
      execution.status === "IN_PROGRESS" &&
      execution.phase2Complete === false,
    "P2_O02_UNBOUND_OR_INVALID_ACCEPTED_BASELINE",
  );
  requireCondition(
    scope?.schemaVersion === "1.0.0" &&
      scope.operationId === P2_O02_ID &&
      scope.enforcementMode === "DENY_BY_DEFAULT" &&
      isDeepStrictEqual(scope.exactPaths, P2_O02_EXACT_PATHS) &&
      isDeepStrictEqual(scope.prefixes, P2_O02_PREFIXES),
    "P2_O02_SCOPE_DECLARATION_MISMATCH",
  );
}

export function validateP2O02RequiredScripts(before, after) {
  for (const [name, command] of Object.entries(before.scripts)) {
    const current = after.scripts?.[name];
    if (name === "quality") {
      requireCondition(
        typeof current === "string" &&
          current
            .split(" && ")
            .filter((step) => step !== "pnpm run result-journal:qualify")
            .join(" && ") === command,
        "P2_O02_REQUIRED_QUALITY_WEAKENED",
      );
    } else requireCondition(current === command, `P2_O02_REQUIRED_SCRIPT_CHANGED: ${name}`);
  }
  requireCondition(
    after.scripts?.["result-journal:qualify"] ===
      "pnpm run build && node scripts/qualification/persistence/qualify-result-journal.mjs",
    "P2_O02_RESULT_QUALIFICATION_COMMAND_MISMATCH",
  );
}

function additiveEntries(before, after, arrayKey, idKey, expectedIds, label) {
  const oldMeta = { ...before };
  const newMeta = { ...after };
  delete oldMeta[arrayKey];
  delete newMeta[arrayKey];
  requireCondition(
    isDeepStrictEqual(oldMeta, newMeta),
    `P2_O02_EXISTING_METADATA_CHANGED: ${label}`,
  );
  const oldEntries = before[arrayKey];
  const newEntries = after[arrayKey];
  requireCondition(
    Array.isArray(oldEntries) && Array.isArray(newEntries),
    `P2_O02_INVALID_ENTRIES: ${label}`,
  );
  const ids = newEntries.map((entry) => entry[idKey]);
  requireCondition(new Set(ids).size === ids.length, `P2_O02_DUPLICATE_ENTRY: ${label}`);
  for (const entry of oldEntries) {
    requireCondition(
      isDeepStrictEqual(
        entry,
        newEntries.find((candidate) => candidate[idKey] === entry[idKey]),
      ),
      `P2_O02_EXISTING_ENTRY_CHANGED: ${label}:${entry[idKey]}`,
    );
  }
  const oldIds = new Set(oldEntries.map((entry) => entry[idKey]));
  const added = newEntries.filter((entry) => !oldIds.has(entry[idKey]));
  requireCondition(
    isDeepStrictEqual(added.map((entry) => entry[idKey]).sort(), [...expectedIds].sort()),
    `P2_O02_UNAUTHORIZED_ADDITION: ${label}`,
  );
  return added;
}

// Validate the complete delta, never merely exempt mutable files from old hashes.
export function validateP2O02ContractDelta({ before, after, schemaText }) {
  const schema = JSON.parse(schemaText);
  requireCondition(schema.$id === RESULT_SCHEMA_ID, "P2_O02_WRONG_SCHEMA_ID");
  const hash = lfHash(schemaText);
  const [registry] = additiveEntries(
    before.registry,
    after.registry,
    "schemas",
    "schemaId",
    [RESULT_SCHEMA_ID],
    "registry",
  );
  requireCondition(
    registry.authorityPath === RESULT_SCHEMA_PATH &&
      registry.sha256 === hash &&
      registry.category === "RUNTIME" &&
      registry.examplesRequired === true,
    "P2_O02_INVALID_NEW_REGISTRY_ENTRY",
  );
  const [inventory] = additiveEntries(
    before.inventory,
    after.inventory,
    "contracts",
    "contractId",
    [RESULT_CONTRACT_ID],
    "inventory",
  );
  requireCondition(
    inventory.schemaId === RESULT_SCHEMA_ID &&
      inventory.authorityPath === RESULT_SCHEMA_PATH &&
      inventory.sha256 === hash &&
      inventory.canonicalOwner === "packages/persistence" &&
      inventory.canonicalName === "ResultJournalAppendBatch" &&
      inventory.schemaVersion === "1.0.0" &&
      inventory.phaseIntroduced === "PHASE_2" &&
      inventory.exampleRequired === true &&
      inventory.publicBoundary === true &&
      isDeepStrictEqual(
        [...inventory.examplePaths].sort(),
        [RESULT_EXAMPLES[0], RESULT_EXAMPLES[2]].sort(),
      ),
    "P2_O02_INVALID_NEW_INVENTORY_ENTRY",
  );
  const [binding] = additiveEntries(
    before.bindings,
    after.bindings,
    "bindings",
    "schemaId",
    [RESULT_SCHEMA_ID],
    "bindings",
  );
  requireCondition(binding.exportName === "ResultJournalAppendBatch", "P2_O02_INVALID_NEW_BINDING");
  const newCases = after.suite.cases.filter(
    (entry) => !before.suite.cases.some((old) => old.caseId === entry.caseId),
  );
  requireCondition(
    newCases.length === 2 && newCases.every((entry) => entry.schemaId === RESULT_SCHEMA_ID),
    "P2_O02_INVALID_NEW_EXAMPLE_CASES",
  );
  additiveEntries(
    before.suite,
    after.suite,
    "cases",
    "caseId",
    newCases.map((entry) => entry.caseId),
    "examples",
  );
  requireCondition(
    isDeepStrictEqual(
      newCases.map((entry) => entry.instancePath).sort(),
      [RESULT_EXAMPLES[0], RESULT_EXAMPLES[2]].sort(),
    ),
    "P2_O02_UNAUTHORIZED_EXAMPLE_PATH",
  );
  requireCondition(
    newCases.every(
      (entry) =>
        entry.expected === (entry.instancePath.includes("/invalid/") ? "INVALID" : "VALID"),
    ),
    "P2_O02_INVALID_EXAMPLE_EXPECTATION",
  );
  return {
    schemaId: RESULT_SCHEMA_ID,
    schemaHash: hash,
    additiveAuthorityPaths: P2_O02_ADDITIVE_AUTHORITY,
  };
}
