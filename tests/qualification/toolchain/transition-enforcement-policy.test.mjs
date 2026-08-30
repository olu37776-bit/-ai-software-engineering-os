import { describe, expect, test } from "vitest";

import {
  AUTHORITY_LOCK_PATH,
  GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
  P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
  P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
  P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
  P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT,
  P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O04_START_GATE_PATH,
  validateAuthorityLockTransition,
  validateGovernanceAmendmentAuthorizationGate,
  validateGovernanceAmendmentChangedPaths,
  validateOperationAuthorityLockTransition,
  validateP1O04StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

const request = {
  trackingIssue: 30,
  implementationBranch: "governance/p1-authority-ownership-amendment",
  baseCommit: "b".repeat(40),
  gatePath: "operations/phase-1/evidence/o01/p1-governance-amendment-authorization-issue-30.json",
};
const exactAmendmentPaths = [
  AUTHORITY_LOCK_PATH,
  "operations/phase-1/executions/p1-o01-authority-ownership-amendment.json",
];
const authorityOwnershipDeltas = [
  {
    afterAllowedOperationIds: ["P1-O02", "P1-O04"],
    beforeAllowedOperationIds: ["P1-O02"],
    path: "packages/contracts/schema-registry.json",
  },
];
const exactGate = {
  schemaVersion: "1.0.0",
  evidenceType: GOVERNANCE_AMENDMENT_EVIDENCE_TYPE,
  trackingIssue: 30,
  decision: "AUTHORIZED",
  subject: {
    repository: "olu37776-bit/-ai-software-engineering-os",
    authorizationBase: "a".repeat(40),
    authorizedBasePolicy: "DIRECT_PROTECTED_MAIN_CHILD_CONTAINING_THIS_GATE",
    implementationBranch: request.implementationBranch,
  },
  verifier: {
    role: "INDEPENDENT_VERIFIER",
    independent: true,
    readOnlySubjectVerification: true,
    remediationPerformed: false,
  },
  authorization: {
    mode: "GOVERNANCE_AMENDMENT",
    allowedChangedPaths: exactAmendmentPaths,
    exactAmendmentPaths,
    authorityOwnershipDeltas,
    unlistedPhase1AuthorityPaths: "DENIED",
  },
  claimBoundary: {
    acceptedAdrMutationAuthorized: false,
    productionRuntimeAuthorized: false,
    p1O02ImplementationAuthorized: false,
  },
};
const gateContext = {
  request,
  repository: exactGate.subject.repository,
  baseCommit: request.baseCommit,
  baseParentCommit: exactGate.subject.authorizationBase,
};

const scopedEntry = {
  path: "packages/contracts/schema-registry.json",
  sha256: "1".repeat(64),
  role: "SCHEMA_REGISTRY",
  mutationPolicy: "OPERATION_SCOPED",
  allowedOperationIds: ["P1-O02"],
};
const baseLock = {
  schemaVersion: "1.0.0",
  enforcementMode: "DENY_BY_DEFAULT",
  authorityFiles: [scopedEntry],
  excludedSelfPath: AUTHORITY_LOCK_PATH,
  verificationRules: ["SELF_PATH_EXCLUDED_FROM_HASH_SET"],
};

describe("Issue #29 exact governance ownership transition", () => {
  test("accepts a canonical exact Gate and the one authorized allowedOperationIds delta", () => {
    expect(validateGovernanceAmendmentAuthorizationGate(exactGate, gateContext)).toEqual({
      allowedChangedPaths: exactAmendmentPaths,
      exactAmendmentPaths,
      authorityOwnershipDeltas,
    });
    expect(
      validateGovernanceAmendmentChangedPaths(
        exactAmendmentPaths,
        exactAmendmentPaths,
        exactAmendmentPaths,
      ),
    ).toEqual([]);

    const headLock = cloneJson(baseLock);
    headLock.authorityFiles[0].allowedOperationIds = ["P1-O02", "P1-O04"];
    expect(
      validateAuthorityLockTransition(
        baseLock,
        headLock,
        exactAmendmentPaths,
        authorityOwnershipDeltas,
      ),
    ).toEqual([]);
  });

  test("rejects missing, extra, mismatched and unrelated ownership deltas", () => {
    const changed = cloneJson(baseLock);
    changed.authorityFiles[0].allowedOperationIds = ["P1-O02", "P1-O04"];
    expect(validateAuthorityLockTransition(baseLock, changed, exactAmendmentPaths)).toContain(
      "UNAUTHORIZED_AUTHORITY_OWNERSHIP_DELTA: packages/contracts/schema-registry.json",
    );

    const mismatch = cloneJson(authorityOwnershipDeltas);
    mismatch[0].afterAllowedOperationIds = ["P1-O02", "P1-O03"];
    expect(
      validateAuthorityLockTransition(baseLock, changed, exactAmendmentPaths, mismatch),
    ).toEqual(
      expect.arrayContaining([
        "MISMATCHED_AUTHORITY_OWNERSHIP_DELTA: packages/contracts/schema-registry.json",
        "EXTRA_AUTHORIZED_AUTHORITY_OWNERSHIP_DELTA: packages/contracts/schema-registry.json",
      ]),
    );

    expect(
      validateAuthorityLockTransition(
        baseLock,
        baseLock,
        exactAmendmentPaths,
        authorityOwnershipDeltas,
      ),
    ).toContain(
      "EXTRA_AUTHORIZED_AUTHORITY_OWNERSHIP_DELTA: packages/contracts/schema-registry.json",
    );

    const roleMutation = cloneJson(changed);
    roleMutation.authorityFiles[0].role = "CONTRACT_INVENTORY";
    expect(
      validateAuthorityLockTransition(
        baseLock,
        roleMutation,
        exactAmendmentPaths,
        authorityOwnershipDeltas,
      ),
    ).toContain("AUTHORITY_LOCK_OWNERSHIP_MUTATION: packages/contracts/schema-registry.json");
  });

  test("requires the exact amendment path set without omission or addition", () => {
    expect(
      validateGovernanceAmendmentChangedPaths(
        [AUTHORITY_LOCK_PATH],
        exactAmendmentPaths,
        exactAmendmentPaths,
      ),
    ).toContain(
      "GOVERNANCE_AMENDMENT_MISSING_EXACT_PATH: operations/phase-1/executions/p1-o01-authority-ownership-amendment.json",
    );
    expect(
      validateGovernanceAmendmentChangedPaths(
        [...exactAmendmentPaths, "operations/phase-1/write-scope.json"],
        [...exactAmendmentPaths, "operations/phase-1/write-scope.json"],
        exactAmendmentPaths,
      ),
    ).toContain("GOVERNANCE_AMENDMENT_NON_EXACT_PATH: operations/phase-1/write-scope.json");
  });

  test.each([
    [
      "duplicate delta",
      (gate) =>
        gate.authorization.authorityOwnershipDeltas.push(
          cloneJson(gate.authorization.authorityOwnershipDeltas[0]),
        ),
    ],
    [
      "noncanonical operation ids",
      (gate) => {
        gate.authorization.authorityOwnershipDeltas[0].afterAllowedOperationIds = [
          "P1-O04",
          "P1-O02",
        ];
      },
    ],
    [
      "unsafe delta path",
      (gate) => {
        gate.authorization.authorityOwnershipDeltas[0].path = "../authority.json";
      },
    ],
    [
      "extra delta field",
      (gate) => {
        gate.authorization.authorityOwnershipDeltas[0].role = "SCHEMA_REGISTRY";
      },
    ],
    ["noncanonical exact paths", (gate) => gate.authorization.exactAmendmentPaths.reverse()],
  ])("rejects %s in a prior Gate", (_label, mutate) => {
    const gate = cloneJson(exactGate);
    mutate(gate);
    expect(() => validateGovernanceAmendmentAuthorizationGate(gate, gateContext)).toThrow();
  });
});

describe("Issue #29 transactional operation Authority Lock refresh", () => {
  const newHash = "2".repeat(64);
  const changedPaths = [AUTHORITY_LOCK_PATH, scopedEntry.path];

  function refreshedLock() {
    const lock = cloneJson(baseLock);
    lock.authorityFiles[0].sha256 = newHash;
    return lock;
  }

  test("accepts only the selected owner's same-diff exact hash refresh", () => {
    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        refreshedLock(),
        "P1-O02",
        changedPaths,
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toEqual([]);
  });

  test("rejects missing, unrelated, wrong-byte, unauthorized and ownership refreshes", () => {
    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        refreshedLock(),
        "P1-O02",
        [scopedEntry.path],
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toEqual(
      expect.arrayContaining([
        `AUTHORITY_LOCK_REFRESH_MISSING: ${scopedEntry.path}`,
        `UNRELATED_AUTHORITY_HASH_REFRESH: ${scopedEntry.path}`,
      ]),
    );

    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        refreshedLock(),
        "P1-O02",
        [AUTHORITY_LOCK_PATH],
        new Map(),
      ),
    ).toContain(`UNRELATED_AUTHORITY_HASH_REFRESH: ${scopedEntry.path}`);

    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        refreshedLock(),
        "P1-O02",
        changedPaths,
        new Map([[scopedEntry.path, "3".repeat(64)]]),
      ),
    ).toContain(`AUTHORITY_LOCK_REFRESH_HASH_MISMATCH: ${scopedEntry.path}`);

    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        refreshedLock(),
        "P1-O04",
        changedPaths,
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toEqual(
      expect.arrayContaining([
        `UNAUTHORIZED_AUTHORITY_HASH_REFRESH: ${scopedEntry.path}`,
        `UNAUTHORIZED_LOCKED_ASSET_CHANGE: ${scopedEntry.path}`,
      ]),
    );

    const ownershipMutation = refreshedLock();
    ownershipMutation.authorityFiles[0].allowedOperationIds = ["P1-O02", "P1-O04"];
    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        ownershipMutation,
        "P1-O02",
        changedPaths,
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toContain(`AUTHORITY_LOCK_OWNERSHIP_MUTATION: ${scopedEntry.path}`);
  });

  test("rejects self-hashing, path-set and top-level mutations", () => {
    const selfHashing = refreshedLock();
    selfHashing.authorityFiles.unshift({ ...scopedEntry, path: AUTHORITY_LOCK_PATH });
    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        selfHashing,
        "P1-O02",
        changedPaths,
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toContain("AUTHORITY_LOCK_PATH_SET_MUTATION");

    const topLevel = refreshedLock();
    topLevel.enforcementMode = "ALLOW_BY_DEFAULT";
    expect(
      validateOperationAuthorityLockTransition(
        baseLock,
        topLevel,
        "P1-O02",
        changedPaths,
        new Map([[scopedEntry.path, newHash]]),
      ),
    ).toContain("AUTHORITY_LOCK_TOP_LEVEL_MUTATION");
  });
});

describe("Issue #29 P1-O04 independent resume Gate", () => {
  const passGate = {
    schemaVersion: "1.0.0",
    evidenceType: "IndependentPhase1TransitionGate",
    trackingIssue: 29,
    decision: "PASS",
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      preliminaryScopeAmendmentMainCommit: P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT,
      transitionEnforcementImplementationCommit: "2".repeat(40),
      transitionEnforcementImplementationTree: "3".repeat(40),
      transitionEnforcementReviewedHeadCommit: "4".repeat(40),
      transitionEnforcementMainCommit: "5".repeat(40),
      finalAmendmentTrackingIssue: 30,
      finalAmendmentAuthorizationGateReviewedHeadCommit: "6".repeat(40),
      finalAmendmentAuthorizationGateMainCommit: "7".repeat(40),
      finalAmendmentImplementationCommit: "8".repeat(40),
      finalAmendmentImplementationTree: "9".repeat(40),
      finalAmendmentReviewedHeadCommit: "a".repeat(40),
      finalAmendmentMainCommit: "b".repeat(40),
      finalAmendmentExecutionPath: P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
      finalAmendmentEvidencePath: P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
    },
    verifier: {
      role: "INDEPENDENT_VERIFIER",
      independent: true,
      readOnlySubjectVerification: true,
      remediationPerformed: false,
    },
    authorization: {
      p1O04Start: "RELEASED",
      authorizedBasePolicy: "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS",
      finalAmendmentChangedPaths: P1_O04_FINAL_AMENDMENT_CHANGED_PATHS,
      finalAuthorityOwnershipDeltas: P1_O04_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    },
    verification: {
      transitionEnforcementIndependentVerdict: "PASS",
      transitionEnforcementExactHeadChecks: "PASS",
      transitionEnforcementPostMergeChecks: "PASS",
      finalAmendmentIndependentVerdict: "PASS",
      finalAmendmentExactHeadChecks: "PASS",
      finalAmendmentPostMergeChecks: "PASS",
    },
    claimBoundary: {
      acceptedAdrChanged: false,
      requiredCheckIdentityChanged: false,
    },
  };

  test("accepts the one canonical Gate contract at the fixed path", () => {
    expect(P1_O04_START_GATE_PATH).toBe(
      "operations/phase-1/evidence/o01/p1-o04-resume-after-issue-29-independent-gate.json",
    );
    expect(validateP1O04StartGate(passGate)).toEqual({
      preliminaryScopeAmendmentMainCommit: P1_O04_PRELIMINARY_SCOPE_AMENDMENT_MAIN_COMMIT,
      transitionEnforcementImplementationCommit: "2".repeat(40),
      transitionEnforcementImplementationTree: "3".repeat(40),
      transitionEnforcementReviewedHeadCommit: "4".repeat(40),
      transitionEnforcementMainCommit: "5".repeat(40),
      finalAmendmentTrackingIssue: 30,
      finalAmendmentAuthorizationGateReviewedHeadCommit: "6".repeat(40),
      finalAmendmentAuthorizationGateMainCommit: "7".repeat(40),
      finalAmendmentImplementationCommit: "8".repeat(40),
      finalAmendmentImplementationTree: "9".repeat(40),
      finalAmendmentReviewedHeadCommit: "a".repeat(40),
      finalAmendmentMainCommit: "b".repeat(40),
      finalAmendmentExecutionPath: P1_O04_FINAL_AMENDMENT_EXECUTION_PATH,
      finalAmendmentEvidencePath: P1_O04_FINAL_AMENDMENT_EVIDENCE_PATH,
    });
  });

  test.each([
    [
      "decision",
      (gate) => {
        gate.decision = "IMPLEMENTED";
      },
    ],
    [
      "issue",
      (gate) => {
        gate.trackingIssue = 28;
      },
    ],
    [
      "independence",
      (gate) => {
        gate.verifier.independent = false;
      },
    ],
    [
      "release",
      (gate) => {
        gate.authorization.p1O04Start = "BLOCKED";
      },
    ],
    [
      "subject",
      (gate) => {
        delete gate.subject.transitionEnforcementMainCommit;
      },
    ],
  ])("rejects invalid %s binding", (_label, mutate) => {
    const gate = cloneJson(passGate);
    mutate(gate);
    expect(() => validateP1O04StartGate(gate)).toThrow("P1_O04_START_BLOCKED");
  });
});
