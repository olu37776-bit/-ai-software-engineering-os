import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

import {
  GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
  GOVERNANCE_AMENDMENT_EXECUTION_TYPE,
  isPhase1GovernedPath,
  resolveOperationDefinition,
  selectEvidenceOperation,
  selectGovernanceAmendmentAuthorizationGate,
  selectMergeExecutionRecord,
  validateAuthorityLockHashes,
  validateAuthorityLockTransition,
  validateExecutionRecord,
  validateGovernanceAmendmentAuthorizationGate,
  validateGovernanceAmendmentChangedPaths,
  validateGovernanceAmendmentExecution,
  validateOperationChangedPaths,
  validateP1O02StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

const root = resolve(import.meta.dirname, "../../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const [operationManifest, writeScope, authorityLock] = await Promise.all([
  readJson("operations/phase-1/operation.json"),
  readJson("operations/phase-1/write-scope.json"),
  readJson("operations/phase-1/authority-lock.json"),
]);

const amendmentRequest = {
  trackingIssue: 14,
  implementationBranch: "governance/p1-execution-scope-amendment",
  baseCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  gatePath: "operations/phase-1/evidence/o01/p1-governance-amendment-authorization-issue-14.json",
};

const amendmentAllowedPaths = [
  "operations/phase-1/authority-lock.json",
  "operations/phase-1/executions/p1-o01-write-scope-amendment.json",
  "operations/phase-1/write-scope.json",
];

const amendmentGate = {
  schemaVersion: "1.0.0",
  evidenceType: GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
  trackingIssue: 14,
  decision: "AUTHORIZED",
  subject: {
    repository: "olu37776-bit/-ai-software-engineering-os",
    authorizationBase: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    authorizedBasePolicy: "DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE",
    implementationBranch: amendmentRequest.implementationBranch,
  },
  verifier: {
    role: "INDEPENDENT_VERIFIER",
    independent: true,
    readOnlySubjectVerification: true,
    remediationPerformed: false,
  },
  authorization: {
    mode: "GOVERNANCE_AMENDMENT",
    allowedChangedPaths: amendmentAllowedPaths,
    unlistedPhase1AuthorityPaths: "DENIED",
  },
  claimBoundary: {
    acceptedAdrMutationAuthorized: false,
    productionRuntimeAuthorized: false,
    p1O02ImplementationAuthorized: false,
  },
};

const amendmentContext = {
  request: amendmentRequest,
  repository: "olu37776-bit/-ai-software-engineering-os",
  baseCommit: amendmentRequest.baseCommit,
  baseParentCommit: amendmentGate.subject.authorizationBase,
};

describe("operation-aware Phase 1 scope policy", () => {
  test.each(operationManifest.suboperations.map(({ operationId }) => [operationId]))(
    "resolves the unique frozen operation and scope for %s",
    (operationId) => {
      expect(resolveOperationDefinition(operationId, operationManifest, writeScope)).toMatchObject({
        manifestOperation: { operationId, writeScopeOperationId: operationId },
        operationScope: { operationId },
      });
    },
  );

  test("fails closed for unknown and ambiguous operation identity", () => {
    expect(() => resolveOperationDefinition("P1-O10", operationManifest, writeScope)).toThrow(
      "UNKNOWN_OPERATION",
    );
    const ambiguousScope = {
      ...writeScope,
      operations: [...writeScope.operations, writeScope.operations[1]],
    };
    expect(() => resolveOperationDefinition("P1-O02", operationManifest, ambiguousScope)).toThrow(
      "AMBIGUOUS_OPERATION",
    );
  });

  test("selects the unique event-base execution when historical records also changed", () => {
    const eventBase = "a".repeat(40);
    const currentRecord = {
      path: "operations/phase-1/executions/p1-o01-base-exact-merge-execution-issue-37.json",
      execution: { baseCommit: eventBase },
    };
    const historicalRecord = {
      path: "operations/phase-1/executions/p1-o01-post-merge-qualification-dispatch-issue-33.json",
      execution: { baseCommit: "b".repeat(40) },
    };

    expect(selectMergeExecutionRecord([historicalRecord, currentRecord], eventBase)).toBe(
      currentRecord,
    );
    expect(
      validateOperationChangedPaths(
        ["operations/phase-1/executions/p1-o02-contract-foundation.json"],
        "P1-O01",
        writeScope,
        authorityLock,
      ),
    ).toContain("NOT_ALLOWED: operations/phase-1/executions/p1-o02-contract-foundation.json");
  });

  test("fails closed for zero or multiple event-base execution matches", () => {
    const eventBase = "a".repeat(40);
    const historicalRecords = [
      { path: "historical-one.json", execution: { baseCommit: "b".repeat(40) } },
      { path: "historical-two.json", execution: { baseCommit: "c".repeat(40) } },
    ];
    expect(() => selectMergeExecutionRecord(historicalRecords, eventBase)).toThrow(
      "MISSING_BASE_MATCHING_CHANGED_EXECUTION_RECORD",
    );

    const duplicateCurrentRecords = [
      { path: "current-one.json", execution: { baseCommit: eventBase } },
      { path: "current-two.json", execution: { baseCommit: eventBase } },
    ];
    expect(() => selectMergeExecutionRecord(duplicateCurrentRecords, eventBase)).toThrow(
      "AMBIGUOUS_BASE_MATCHING_CHANGED_EXECUTION_RECORD",
    );
  });

  test("preserves the single-record base mismatch for caller rejection", () => {
    const record = {
      path: "single.json",
      execution: { baseCommit: "b".repeat(40) },
    };
    expect(selectMergeExecutionRecord([record], "a".repeat(40))).toBe(record);
  });

  test("accepts an O02 Contract fixture under O02 and rejects it under O01", () => {
    const fixture = ["packages/contracts/src/runtime-validator.ts"];
    expect(validateOperationChangedPaths(fixture, "P1-O02", writeScope, authorityLock)).toEqual([]);
    expect(validateOperationChangedPaths(fixture, "P1-O01", writeScope, authorityLock)).toContain(
      "DENIED: packages/contracts/src/runtime-validator.ts",
    );
  });

  test("rejects global, operation and broad Phase 1 bypass paths", () => {
    expect(
      validateOperationChangedPaths(
        ["docs/decisions/ADR-0007-typescript-toolchain-baseline.md"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toEqual(
      expect.arrayContaining([
        "DENIED: docs/decisions/ADR-0007-typescript-toolchain-baseline.md",
        "IMMUTABLE: docs/decisions/ADR-0007-typescript-toolchain-baseline.md",
      ]),
    );
    expect(
      validateOperationChangedPaths(
        ["packages/kernel/src/index.ts"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toContain("DENIED: packages/kernel/src/index.ts");
    expect(
      validateOperationChangedPaths(
        ["operations/phase-1/unapproved-bypass.json"],
        "P1-O02",
        writeScope,
        authorityLock,
      ),
    ).toContain("NOT_ALLOWED: operations/phase-1/unapproved-bypass.json");
    expect(
      isPhase1GovernedPath("operations/phase-1/unapproved-bypass.json", writeScope, authorityLock),
    ).toBe(true);
  });

  test("enforces every declared Authority Lock owner and rejects an unrelated operation", () => {
    const path = "packages/contracts/schema-registry.json";
    const authority = authorityLock.authorityFiles.find((entry) => entry.path === path);
    expect(authority).toBeDefined();

    for (const operationId of authority.allowedOperationIds) {
      expect(validateOperationChangedPaths([path], operationId, writeScope, authorityLock)).toEqual(
        [],
      );
    }

    const unrelatedOperationId = operationManifest.suboperations
      .map(({ operationId }) => operationId)
      .find((operationId) => !authority.allowedOperationIds.includes(operationId));
    expect(unrelatedOperationId).toBeDefined();
    expect(
      validateOperationChangedPaths([path], unrelatedOperationId, writeScope, authorityLock),
    ).toContain(`AUTHORITY_OPERATION_DENIED: ${path}`);
  });

  test("binds execution path, operation identity, branch and base metadata", () => {
    const valid = {
      operationId: "P1-O02",
      writeScopeOperationId: "P1-O02",
      implementationBranch: "phase-1/p1-o02-contract-foundation",
      baseCommit: "6bc651f7db0dc979b63cdafbc6d4747fdd26f8e9",
    };
    expect(
      validateExecutionRecord(
        "operations/phase-1/executions/p1-o02-contracts.json",
        valid,
        operationManifest,
        writeScope,
      ),
    ).toBe("P1-O02");
    expect(() =>
      validateExecutionRecord(
        "operations/phase-1/executions/p1-o01-contracts.json",
        valid,
        operationManifest,
        writeScope,
      ),
    ).toThrow("MISMATCHED_EXECUTION_OPERATION");
  });

  test("selects independent Evidence only from one operation namespace", () => {
    expect(selectEvidenceOperation(["operations/phase-1/evidence/o02/p1-v03.json"])).toBe("P1-O02");
    expect(
      selectEvidenceOperation([
        "operations/phase-1/evidence/o01/gate.json",
        "operations/phase-1/evidence/o02/gate.json",
      ]),
    ).toBeUndefined();
    expect(selectEvidenceOperation(["docs/reviews/phase-1-gate.md"])).toBeUndefined();
  });

  test("keeps P1-O02 blocked until an independent Issue #11 PASS Gate", () => {
    const passGate = {
      schemaVersion: "1.0.0",
      evidenceType: "IndependentPhase1TransitionGate",
      trackingIssue: 11,
      decision: "PASS",
      subject: {
        remediationImplementationCommit: "0123456789abcdef0123456789abcdef01234567",
      },
      verifier: { role: "INDEPENDENT_VERIFIER", independent: true },
      authorization: { p1O02Start: "RELEASED" },
    };
    expect(validateP1O02StartGate(passGate)).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(() => validateP1O02StartGate({ ...passGate, decision: "IMPLEMENTED" })).toThrow(
      "P1_O02_START_BLOCKED",
    );
    expect(() =>
      validateP1O02StartGate({
        ...passGate,
        verifier: { role: "IMPLEMENTATION_AGENT", independent: false },
      }),
    ).toThrow("P1_O02_START_BLOCKED");
  });

  test("recognizes only an explicitly bound P1-O01 governance amendment execution", () => {
    expect(
      validateGovernanceAmendmentExecution({
        executionType: GOVERNANCE_AMENDMENT_EXECUTION_TYPE,
        operationId: "P1-O01",
        writeScopeOperationId: "P1-O01",
        trackingIssue: amendmentRequest.trackingIssue,
        implementationBranch: amendmentRequest.implementationBranch,
        baseCommit: amendmentRequest.baseCommit,
        priorAuthorizationGateRef: amendmentRequest.gatePath,
      }),
    ).toEqual(amendmentRequest);
    expect(
      validateGovernanceAmendmentExecution({ executionType: "NORMAL_OPERATION" }),
    ).toBeUndefined();
    expect(() =>
      validateGovernanceAmendmentExecution({
        executionType: GOVERNANCE_AMENDMENT_EXECUTION_TYPE,
        operationId: "P1-O02",
        writeScopeOperationId: "P1-O02",
        trackingIssue: 14,
        priorAuthorizationGateRef: amendmentRequest.gatePath,
      }),
    ).toThrow("INVALID_GOVERNANCE_AMENDMENT_OWNER");
  });

  test("accepts a prior independent Gate and its exact changed-path subset", () => {
    expect(
      selectGovernanceAmendmentAuthorizationGate(
        [{ path: amendmentRequest.gatePath, gate: amendmentGate }],
        amendmentRequest,
      ),
    ).toBe(amendmentGate);
    expect(validateGovernanceAmendmentAuthorizationGate(amendmentGate, amendmentContext)).toEqual({
      allowedChangedPaths: amendmentAllowedPaths,
    });
    expect(
      validateGovernanceAmendmentChangedPaths(
        [
          "operations/phase-1/executions/p1-o01-write-scope-amendment.json",
          "operations/phase-1/write-scope.json",
        ],
        amendmentAllowedPaths,
      ),
    ).toEqual([]);
  });

  test("fails closed when the Gate is missing from base, including a head-only Gate", () => {
    const headOnlyCandidates = [{ path: amendmentRequest.gatePath, gate: amendmentGate }];
    expect(headOnlyCandidates).toHaveLength(1);
    expect(() => selectGovernanceAmendmentAuthorizationGate([], amendmentRequest)).toThrow(
      "MISSING_PRIOR_GOVERNANCE_AMENDMENT_GATE",
    );
  });

  test("fails closed for malformed or self-authorizing Gate input", () => {
    expect(() =>
      validateGovernanceAmendmentAuthorizationGate(
        { ...amendmentGate, verifier: { role: "IMPLEMENTATION_AGENT" } },
        amendmentContext,
      ),
    ).toThrow("MALFORMED_OR_MISMATCHED_GOVERNANCE_AMENDMENT_GATE");

    const selfAuthorizing = cloneJson(amendmentGate);
    selfAuthorizing.authorization.allowedChangedPaths = [amendmentRequest.gatePath];
    expect(() =>
      validateGovernanceAmendmentAuthorizationGate(selfAuthorizing, amendmentContext),
    ).toThrow("FORBIDDEN_GOVERNANCE_AMENDMENT_ALLOWED_PATH");
  });

  test.each([
    ["issue", { trackingIssue: 99 }],
    ["branch", { subject: { ...amendmentGate.subject, implementationBranch: "wrong-branch" } }],
    ["base", { subject: { ...amendmentGate.subject, authorizationBase: "c".repeat(40) } }],
  ])("fails closed for a Gate with the wrong %s binding", (_label, override) => {
    const candidate = {
      ...amendmentGate,
      ...override,
    };
    expect(() => validateGovernanceAmendmentAuthorizationGate(candidate, amendmentContext)).toThrow(
      "MALFORMED_OR_MISMATCHED_GOVERNANCE_AMENDMENT_GATE",
    );
  });

  test("fails closed for extra paths and forbidden ADR or Runtime authorization", () => {
    expect(
      validateGovernanceAmendmentChangedPaths(
        [...amendmentAllowedPaths, "docs/roadmap/not-authorized.md"],
        amendmentAllowedPaths,
      ),
    ).toContain("GOVERNANCE_AMENDMENT_EXTRA_PATH: docs/roadmap/not-authorized.md");

    for (const forbiddenPath of [
      "docs/decisions/ADR-0001-runtime-architecture.md",
      "packages/kernel/src/runtime.ts",
      "apps/private-runtime/src/index.ts",
    ]) {
      const gate = cloneJson(amendmentGate);
      gate.authorization.allowedChangedPaths = [forbiddenPath];
      expect(() => validateGovernanceAmendmentAuthorizationGate(gate, amendmentContext)).toThrow(
        "FORBIDDEN_GOVERNANCE_AMENDMENT_ALLOWED_PATH",
      );
    }
  });

  test("rejects unrelated Authority Lock mutation or unlock and validates the complete lock", () => {
    const baseLock = {
      schemaVersion: "1.0.0",
      excludedSelfPath: "operations/phase-1/authority-lock.json",
      authorityFiles: [
        {
          path: "operations/phase-1/write-scope.json",
          sha256: "a".repeat(64),
          role: "WRITE_SCOPE",
          mutationPolicy: "CONTROLLED",
          allowedOperationIds: ["P1-O01"],
        },
        {
          path: "docs/decisions/ADR-0001-runtime-architecture.md",
          sha256: "b".repeat(64),
          role: "ACCEPTED_ADR",
          mutationPolicy: "IMMUTABLE",
          allowedOperationIds: [],
        },
      ],
    };
    const unrelatedMutation = cloneJson(baseLock);
    unrelatedMutation.authorityFiles[1].sha256 = "c".repeat(64);
    expect(
      validateAuthorityLockTransition(baseLock, unrelatedMutation, amendmentAllowedPaths),
    ).toContain(
      "UNRELATED_AUTHORITY_LOCK_MUTATION: docs/decisions/ADR-0001-runtime-architecture.md",
    );

    const unlock = cloneJson(baseLock);
    unlock.authorityFiles[1].mutationPolicy = "CONTROLLED";
    expect(validateAuthorityLockTransition(baseLock, unlock, amendmentAllowedPaths)).toContain(
      "AUTHORITY_LOCK_OWNERSHIP_MUTATION: docs/decisions/ADR-0001-runtime-architecture.md",
    );

    expect(
      validateAuthorityLockHashes(
        baseLock,
        new Map(baseLock.authorityFiles.map(({ path, sha256 }) => [path, sha256])),
      ),
    ).toEqual([]);
    expect(validateAuthorityLockHashes(unrelatedMutation, new Map())).toEqual(
      expect.arrayContaining([
        "AUTHORITY_FILE_MISSING: operations/phase-1/write-scope.json",
        "AUTHORITY_FILE_MISSING: docs/decisions/ADR-0001-runtime-architecture.md",
      ]),
    );
  });
});
