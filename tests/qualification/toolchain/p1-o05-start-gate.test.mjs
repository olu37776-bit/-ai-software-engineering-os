import { describe, expect, test } from "vitest";

import {
  P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT,
  P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
  P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
  P1_O05_START_GATE_PATH,
  validateP1O05StartGate,
} from "../../../scripts/toolchain/scope-policy.mjs";

function makeGate() {
  return {
    schemaVersion: "1.0.0",
    evidenceType: "IndependentPhase1TransitionGate",
    trackingIssue: 53,
    decision: "PASS",
    subject: {
      repository: "olu37776-bit/-ai-software-engineering-os",
      scopeAuthorizationGateReviewedHeadCommit: "1".repeat(40),
      scopeAuthorizationGateMainCommit: P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentImplementationCommit: "2".repeat(40),
      scopeAuthorityAmendmentImplementationTree: "3".repeat(40),
      scopeAuthorityAmendmentReviewedHeadCommit: "4".repeat(40),
      scopeAuthorityAmendmentMainCommit: P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      scopeAuthorityAmendmentExecutionPath: P1_O05_SCOPE_AUTHORITY_AMENDMENT_EXECUTION_PATH,
      scopeAuthorityAmendmentEvidencePath: P1_O05_SCOPE_AUTHORITY_AMENDMENT_EVIDENCE_PATH,
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
      p1O05Start: "RELEASED",
      authorizedBasePolicy: "PROTECTED_MAIN_COMMIT_CONTAINING_THIS_GATE_AFTER_POST_MERGE_PASS",
      scopeAuthorityAmendmentChangedPaths: P1_O05_SCOPE_AUTHORITY_AMENDMENT_CHANGED_PATHS,
      authorityOwnershipDeltas: P1_O05_REQUIRED_AUTHORITY_OWNERSHIP_DELTAS,
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
      p1O05Implemented: false,
      acceptedAdrChanged: false,
      requiredCheckIdentityChanged: false,
      alternatePersistenceDriverAuthorized: false,
    },
  };
}

describe("P1-O05 Issue #53 start Gate policy", () => {
  test("accepts only the fixed Gate path and exact closed transition bindings", () => {
    expect(P1_O05_START_GATE_PATH).toBe(
      "operations/phase-1/evidence/o01/p1-o05-start-after-issue-53-independent-gate.json",
    );
    expect(validateP1O05StartGate(makeGate())).toMatchObject({
      scopeAuthorizationGateMainCommit: P1_O05_AUTHORIZATION_GATE_MAIN_COMMIT,
      scopeAuthorityAmendmentMainCommit: P1_O05_SCOPE_AUTHORITY_AMENDMENT_MAIN_COMMIT,
      transitionEnforcementImplementationCommit: "5".repeat(40),
      transitionEnforcementImplementationTree: "6".repeat(40),
      transitionEnforcementReviewedHeadCommit: "7".repeat(40),
      transitionEnforcementMainCommit: "8".repeat(40),
    });
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
        gate.trackingIssue = 29;
      },
    ],
    [
      "repository",
      (gate) => {
        gate.subject.repository = "other/repository";
      },
    ],
    [
      "amendment main",
      (gate) => {
        gate.subject.scopeAuthorityAmendmentMainCommit = "9".repeat(40);
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
        gate.authorization.p1O05Start = "BLOCKED";
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
      "post-merge verification",
      (gate) => {
        gate.verification.transitionEnforcementPostMergeChecks = "FAIL";
      },
    ],
    [
      "runtime claim",
      (gate) => {
        gate.claimBoundary.p1O05Implemented = true;
      },
    ],
    [
      "fallback claim",
      (gate) => {
        gate.claimBoundary.alternatePersistenceDriverAuthorized = true;
      },
    ],
  ])("rejects malformed %s binding", (_label, mutate) => {
    const gate = makeGate();
    mutate(gate);
    expect(() => validateP1O05StartGate(gate)).toThrow("P1_O05_START_BLOCKED");
  });
});
