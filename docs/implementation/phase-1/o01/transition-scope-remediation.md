# Phase 1 operation-aware scope transition

Issue #11 is a required transition remediation between the independently verified P1-O01 toolchain foundation and the start of P1-O02.

The scope validator resolves `P1-O01` through `P1-O09` from the frozen operation manifest, the matching operation-specific WRITE_SCOPE and a version-controlled execution record. The execution record binds the operation identity, implementation branch and authorized base. Pull-request and protected-main event bases are additionally supplied by GitHub Actions and must agree with that record.

The validator fails closed when the operation is missing, unknown, ambiguous, or inconsistent with its execution path, branch, WRITE_SCOPE identity or authorized base. Global and operation-specific denials are applied before allow rules, immutable Authority Lock hashes are checked on every invocation, and operation-scoped authority files remain limited to their declared operation IDs.

An independent verification Evidence-only change may resolve its operation from the unique `operations/phase-1/evidence/oNN/**` namespace after the corresponding execution exists. A non-operation governance change passes only when none of its changed paths are governed by Phase 1. In particular, a broad `operations/phase-1/**` change cannot use the non-operation route.

`pnpm run quality` remains safe for repository-wide and non-operation governance use. Phase 1 scope validation is a separate mandatory GitHub quality step, while `pnpm run quality:phase1` provides the combined local operation gate.

P1-O02 is `BLOCKED_PENDING_INDEPENDENT_VERIFICATION`. This implementation may declare at most `IMPLEMENTED`; P1-O02 can be released only by an independent PASS Gate merged through protected `main`. The validator requires that Gate at `operations/phase-1/evidence/o01/p1-transition-scope-independent-gate.json` in the P1-O02 execution's authorized base. It must identify Issue #11, declare `IndependentPhase1TransitionGate` / `PASS`, identify an independent verifier, release `p1O02Start`, and bind an ancestor remediation implementation commit.

The minimum independent Gate contract is:

```json
{
  "schemaVersion": "1.0.0",
  "evidenceType": "IndependentPhase1TransitionGate",
  "trackingIssue": 11,
  "decision": "PASS",
  "subject": {
    "remediationImplementationCommit": "<40-character commit SHA>"
  },
  "verifier": {
    "role": "INDEPENDENT_VERIFIER",
    "independent": true
  },
  "authorization": {
    "p1O02Start": "RELEASED"
  }
}
```
