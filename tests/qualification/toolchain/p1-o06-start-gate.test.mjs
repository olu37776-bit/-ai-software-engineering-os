import { describe, expect, test } from "vitest";

import {
  P1_O06_AUTHORIZATION_GATE_MAIN_COMMIT,
  P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
  P1_O06_REQUIRED_SCOPE_PATHS,
  P1_O06_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
  P1_O06_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
  P1_O06_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
  P1_O06_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
  P1_O06_START_GATE_PATH,
  validateP1O06StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

const transitionEnforcementBaseCommit = "d05c7d85fcf281453329cc2e2f561a1031872376";

function makeGate() {
  return {
    schemaVersion: "1.0.0",
    evidenceType: "IndependentPhase1TransitionGate",
    trackingIssue: 64,
    decision: "PASS",
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      scopeAuthorizationGateReviewedHeadCommit: "1".repeat(40),
      scopeAuthorizationGateMainCommit: P1_O06_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentImplementationCommit: "2".repeat(40),
      scopeAuthorityAmendmentImplementationTree: "3".repeat(40),
      scopeAuthorityAmendmentReviewedHeadCommit: "4".repeat(40),
      scopeAuthorityAmendmentMainCommit: P1_O06_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      scopeAuthorityAmendmentExecutionPath: P1_O06_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
      scopeAuthorityAmendmentEvidencePath: P1_O06_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
      transitionEnforcementBaseCommit,
      transitionEnforcementImplementationCommit: "5".repeat(40),
      transitionEnforcementImplementationTree: "6".repeat(40),
      transitionEnforcementReviewedHeadCommit: "7".repeat(40),
      transitionEnforcementMainCommit: "8".repeat(40),
    },
    verifier: {
      role: "INDEPENDENT_VERIFIER",
      independent: true,
      readOnlySubjectVerification: true,
      remediationPerformed: false,
    },
    authorization: {
      p1O06Start: "RELEASED",
      authorizedBasePolicy: "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS",
      scopeAuthorityAmendmentChangedPaths: P1_O06_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
      authorityOwnershipDeltas: P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
    },
    verification: {
      scopeAuthorityAmendmentIndependentVerdict: "PASS",
      scopeAuthorityAmendmentExactHeadChecks: "PASS",
      scopeAuthorityAmendmentPostMergeChecks: "PASS",
      transitionEnforcementIndependentVerdict: "PASS",
      transitionEnforcementExactHeadChecks: "PASS",
      transitionEnforcementPostMergeChecks: "PASS",
    },
    claimBoundary: {
      p1O06Implemented: false,
      acceptedAdrChanged: false,
      requiredCheckIdentityChanged: false,
      productionRuntimeAuthorized: false,
    },
  };
}

describe("P1-O06 Issue #64 start Gate policy", () => {
  test("accepts only the fixed Gate path and exact closed transition bindings", () => {
    expect(P1_O06_AUTHORIZATION_GATE_MAIN_COMMIT).toBe("3906546ccc5e001935416bb0c7e037663aeaf2e4");
    expect(P1_O06_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT).toBe(
      "4d0aedd2a9b696e1ebea8b49ec60b487449583c1",
    );
    expect(P1_O06_START_GATE_PATH).toBe(
      "operations/phase-1/evidence/o01/p1-o06-start-after-issue-64-independent-gate.json",
    );
    expect(validateP1O06StartGate(makeGate())).toMatchObject({
      scopeAuthorizationGateMainCommit: P1_O06_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentMainCommit: P1_O06_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      transitionEnforcementBaseCommit,
      transitionEnforcementImplementationCommit: "5".repeat(40),
      transitionEnforcementImplementationTree: "6".repeat(40),
      transitionEnforcementReviewedHeadCommit: "7".repeat(40),
      transitionEnforcementMainCommit: "8".repeat(40),
    });
    expect(P1_O06_REQUIRED_SCOPE_PATHS).toEqual([
      "package.json",
      "packages/contracts/README.md",
      "packages/contracts/examples/control-api/**",
      "packages/contracts/planned-contracts.json",
      "packages/contracts/schema-inventory.json",
      "packages/contracts/schema-registry.json",
      "packages/contracts/schemas/platform/**",
      "packages/contracts/src/types.generated.ts",
      "packages/contracts/type-bindings.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tests/contract/control-api/**",
      "tsconfig.build.json",
      "vitest.config.mjs",
    ]);
    expect(P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_PATHS).toEqual([
      "packages/contracts/planned-contracts.json",
      "packages/contracts/schema-inventory.json",
      "packages/contracts/schema-registry.json",
    ]);
    expect(P1_O06_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS).toEqual([
      "docs/roadmap/phase-1-write-scope.md",
      "operations/phase-1/authority-lock.json",
      "operations/phase-1/evidence/o01/p1-o06-scope-authority-amendment.json",
      "operations/phase-1/executions/p1-o01-p1-o06-scope-authority-amendment.json",
      "operations/phase-1/write-scope.json",
    ]);
    expect(P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS).toEqual(
      P1_O06_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.map((path) => ({
        afterAllowedOperationIds: ["P1-O02", "P1-O04", "P1-O05", "P1-O06"],
        beforeAllowedOperationIds: ["P1-O02", "P1-O04", "P1-O05"],
        path,
      })),
    );
  });

  test.each([
    [
      "decision",
      (gate) => {
        gate.decision = "FAIL";
      },
    ],
    [
      "tracking issue",
      (gate) => {
        gate.trackingIssue = 53;
      },
    ],
    [
      "repository",
      (gate) => {
        gate.subject.repository = "other/repository";
      },
    ],
    [
      "authorization Gate main",
      (gate) => {
        gate.subject.scopeAuthorizationGateMainCommit = "9".repeat(40);
      },
    ],
    [
      "amendment main",
      (gate) => {
        gate.subject.scopeAuthorityAmendmentMainCommit = "9".repeat(40);
      },
    ],
    [
      "enforcement base",
      (gate) => {
        gate.subject.transitionEnforcementBaseCommit = "9".repeat(40);
      },
    ],
    [
      "enforcement implementation tree",
      (gate) => {
        gate.subject.transitionEnforcementImplementationTree = "not-a-tree";
      },
    ],
    [
      "amendment execution path",
      (gate) => {
        gate.subject.scopeAuthorityAmendmentExecutionPath = "wrong.json";
      },
    ],
    [
      "amendment evidence path",
      (gate) => {
        gate.subject.scopeAuthorityAmendmentEvidencePath = "wrong.json";
      },
    ],
    [
      "independence",
      (gate) => {
        gate.verifier.independent = false;
      },
    ],
    [
      "read-only role",
      (gate) => {
        gate.verifier.readOnlySubjectVerification = false;
      },
    ],
    [
      "release",
      (gate) => {
        gate.authorization.p1O06Start = "BLOCKED";
      },
    ],
    [
      "changed paths",
      (gate) => {
        gate.authorization.scopeAuthorityAmendmentChangedPaths = [];
      },
    ],
    [
      "owner delta",
      (gate) => {
        gate.authorization.authorityOwnershipDeltas = [];
      },
    ],
    [
      "amendment independent verdict",
      (gate) => {
        gate.verification.scopeAuthorityAmendmentIndependentVerdict = "FAIL";
      },
    ],
    [
      "post-merge verification",
      (gate) => {
        gate.verification.transitionEnforcementPostMergeChecks = "FAIL";
      },
    ],
    [
      "runtime claim",
      (gate) => {
        gate.claimBoundary.p1O06Implemented = true;
      },
    ],
    [
      "production runtime claim",
      (gate) => {
        gate.claimBoundary.productionRuntimeAuthorized = true;
      },
    ],
  ])("rejects malformed %s binding", (_label, mutate) => {
    const gate = makeGate();
    mutate(gate);
    expect(() => validateP1O06StartGate(gate)).toThrow("P1_O06_START_BLOCKED");
  });
});
