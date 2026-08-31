import { describe, expect, test } from "vitest";

import {
  P1_O07_AUTHORIZATION_GATE_MAIN_COMMIT,
  P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_PATHS,
  P1_O07_REQUIRED_SCOPE_PATHS,
  P1_O07_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
  P1_O07_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
  P1_O07_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
  P1_O07_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
  P1_O07_START_GATE_PATH,
  validateP1O07StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

const transitionEnforcementBaseCommit = "ce7373c980141ba65e1ba9b65592fdbedc6029b8";

function makeGate() {
  return {
    schemaVersion: "1.0.0",
    evidenceType: "IndependentPhase1TransitionGate",
    trackingIssue: 71,
    decision: "PASS",
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      scopeAuthorizationGateReviewedHeadCommit: "1".repeat(40),
      scopeAuthorizationGateMainCommit: P1_O07_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentImplementationCommit: "2".repeat(40),
      scopeAuthorityAmendmentImplementationTree: "3".repeat(40),
      scopeAuthorityAmendmentReviewedHeadCommit: "4".repeat(40),
      scopeAuthorityAmendmentMainCommit: P1_O07_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      scopeAuthorityAmendmentExecutionPath: P1_O07_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
      scopeAuthorityAmendmentEvidencePath: P1_O07_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
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
      p1O07Start: "RELEASED",
      authorizedBasePolicy: "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS",
      scopeAuthorityAmendmentChangedPaths: P1_O07_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
      authorityOwnershipDeltas: P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
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
      p1O07Implemented: false,
      acceptedAdrChanged: false,
      requiredCheckIdentityChanged: false,
      productionRuntimeAuthorized: false,
      isolationDowngradeAuthorized: false,
    },
  };
}

describe("P1-O07 Issue #71 start Gate policy", () => {
  test("accepts only the fixed Gate path and exact closed transition bindings", () => {
    expect(P1_O07_AUTHORIZATION_GATE_MAIN_COMMIT).toBe("ad9ad7c5602c40aafcdbfb3d4e96c139366e7f6e");
    expect(P1_O07_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT).toBe(
      "ce7373c980141ba65e1ba9b65592fdbedc6029b8",
    );
    expect(P1_O07_START_GATE_PATH).toBe(
      "operations/phase-1/evidence/o01/p1-o07-start-after-issue-71-independent-gate.json",
    );
    expect(validateP1O07StartGate(makeGate())).toMatchObject({
      scopeAuthorizationGateMainCommit: P1_O07_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentMainCommit: P1_O07_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      transitionEnforcementBaseCommit,
      transitionEnforcementImplementationCommit: "5".repeat(40),
      transitionEnforcementImplementationTree: "6".repeat(40),
      transitionEnforcementReviewedHeadCommit: "7".repeat(40),
      transitionEnforcementMainCommit: "8".repeat(40),
    });
    expect(P1_O07_REQUIRED_SCOPE_PATHS).toEqual([
      "package.json",
      "packages/contracts/README.md",
      "packages/contracts/examples/isolation/**",
      "packages/contracts/planned-contracts.json",
      "packages/contracts/schema-inventory.json",
      "packages/contracts/schema-registry.json",
      "packages/contracts/src/types.generated.ts",
      "packages/contracts/type-bindings.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "tests/contract/isolation/**",
      "tsconfig.build.json",
      "vitest.config.mjs",
    ]);
    expect(P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_PATHS).toEqual([
      "packages/contracts/planned-contracts.json",
      "packages/contracts/schema-inventory.json",
      "packages/contracts/schema-registry.json",
    ]);
    expect(P1_O07_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS).toEqual([
      "docs/roadmap/phase-1-write-scope.md",
      "operations/phase-1/authority-lock.json",
      "operations/phase-1/evidence/o01/p1-o07-scope-authority-amendment.json",
      "operations/phase-1/executions/p1-o01-p1-o07-scope-authority-amendment.json",
      "operations/phase-1/write-scope.json",
    ]);
    expect(P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS).toEqual(
      P1_O07_REQUIRED_AUTHORITY_OWNERSHIP_PATHS.map((path) => ({
        afterAllowedOperationIds: ["P1-O02", "P1-O04", "P1-O05", "P1-O06", "P1-O07"],
        beforeAllowedOperationIds: ["P1-O02", "P1-O04", "P1-O05", "P1-O06"],
        path,
      })),
    );
  });

  test.each([
    [
      "schema version",
      (gate) => {
        gate.schemaVersion = "2.0.0";
      },
    ],
    [
      "evidence type",
      (gate) => {
        gate.evidenceType = "SelfApprovedTransitionGate";
      },
    ],
    [
      "decision",
      (gate) => {
        gate.decision = "FAIL";
      },
    ],
    [
      "tracking issue",
      (gate) => {
        gate.trackingIssue = 64;
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
      "verifier role",
      (gate) => {
        gate.verifier.role = "IMPLEMENTER";
      },
    ],
    [
      "read-only role",
      (gate) => {
        gate.verifier.readOnlySubjectVerification = false;
      },
    ],
    [
      "self remediation",
      (gate) => {
        gate.verifier.remediationPerformed = true;
      },
    ],
    [
      "release",
      (gate) => {
        gate.authorization.p1O07Start = "BLOCKED";
      },
    ],
    [
      "authorized base policy",
      (gate) => {
        gate.authorization.authorizedBasePolicy = "HEAD_CONTAINING_GATE";
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
      "amendment exact-head verification",
      (gate) => {
        gate.verification.scopeAuthorityAmendmentExactHeadChecks = "FAIL";
      },
    ],
    [
      "amendment post-merge verification",
      (gate) => {
        gate.verification.scopeAuthorityAmendmentPostMergeChecks = "FAIL";
      },
    ],
    [
      "enforcement independent verdict",
      (gate) => {
        gate.verification.transitionEnforcementIndependentVerdict = "FAIL";
      },
    ],
    [
      "enforcement exact-head verification",
      (gate) => {
        gate.verification.transitionEnforcementExactHeadChecks = "FAIL";
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
        gate.claimBoundary.p1O07Implemented = true;
      },
    ],
    [
      "accepted ADR claim",
      (gate) => {
        gate.claimBoundary.acceptedAdrChanged = true;
      },
    ],
    [
      "required-check claim",
      (gate) => {
        gate.claimBoundary.requiredCheckIdentityChanged = true;
      },
    ],
    [
      "production runtime claim",
      (gate) => {
        gate.claimBoundary.productionRuntimeAuthorized = true;
      },
    ],
    [
      "isolation downgrade claim",
      (gate) => {
        gate.claimBoundary.isolationDowngradeAuthorized = true;
      },
    ],
  ])("rejects malformed %s binding", (_label, mutate) => {
    const gate = makeGate();
    mutate(gate);
    expect(() => validateP1O07StartGate(gate)).toThrow("P1_O07_START_BLOCKED");
  });
});
