import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  isPhase1GovernedPath,
  operationIdFromExecutionPath,
  P1_O02_START_GATE_PATH,
  resolveOperationDefinition,
  selectEvidenceOperation,
  validateExecutionRecord,
  validateOperationChangedPaths,
  validateP1O02StartGate,
} from "./scope-policy.mjs";
import { readJson, reportAndExit, repositoryRoot, run, sha256Utf8LfFile } from "./lib.mjs";

const CHECK = "PHASE1_OPERATION_AWARE_WRITE_SCOPE";
const EXECUTION_DIRECTORY = "operations/phase-1/executions";

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

function changedPathsFrom(baseCommit, headCommit) {
  const tracked = gitOutput(["diff", "--name-only", baseCommit, headCommit])
    .split(/\r?\n/)
    .filter(Boolean);
  const worktree = gitOutput(["diff", "--name-only", headCommit]).split(/\r?\n/).filter(Boolean);
  const untracked = gitOutput(["ls-files", "--others", "--exclude-standard"])
    .split(/\r?\n/)
    .filter(Boolean);
  return [...new Set([...tracked, ...worktree, ...untracked])].sort();
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

function verifyOperationStartGate(operationId, baseCommit) {
  if (operationId !== "P1-O02") {
    return { required: false };
  }
  let gate;
  try {
    gate = JSON.parse(gitOutput(["show", `${baseCommit}:${P1_O02_START_GATE_PATH}`]));
  } catch {
    throw new Error(
      `P1_O02_START_BLOCKED: ${P1_O02_START_GATE_PATH} is absent from authorized base ${baseCommit}`,
    );
  }
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

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const operationManifest = await readJson("operations/phase-1/operation.json");
  const writeScope = await readJson("operations/phase-1/write-scope.json");
  const authorityLock = await readJson("operations/phase-1/authority-lock.json");
  if (writeScope.enforcementMode !== "DENY_BY_DEFAULT") {
    throw new Error(`INVALID_ENFORCEMENT_MODE: ${writeScope.enforcementMode}`);
  }
  const immutableAuthorityFilesVerified = await verifyImmutableAuthority(authorityLock);
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
    const operationId = selectedRecord.execution.operationId;
    const baseCommit = selectedRecord.execution.baseCommit;
    assertCommit(baseCommit, "EXECUTION_BASE");
    assertAncestor(baseCommit, headCommit);
    validateEventBase(event, branch, eventBase, baseCommit, headCommit);
    const operationStartGate = verifyOperationStartGate(operationId, baseCommit);
    const changedPaths = changedPathsFrom(baseCommit, headCommit);
    const violations = validateOperationChangedPaths(
      changedPaths,
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
  if (changedExecutionRecords.length > 1) {
    throw new Error(
      `AMBIGUOUS_CHANGED_EXECUTION_RECORD: ${changedExecutionRecords.map(({ path }) => path).join(",")}`,
    );
  }
  if (changedExecutionRecords.length === 1) {
    const [record] = changedExecutionRecords;
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
    const violations = validateOperationChangedPaths(
      changedPaths,
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
      immutableAuthorityFilesVerified,
      changedPaths,
      violations,
    });
    return;
  }

  const evidenceOperation = selectEvidenceOperation(changedPaths);
  if (evidenceOperation) {
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
