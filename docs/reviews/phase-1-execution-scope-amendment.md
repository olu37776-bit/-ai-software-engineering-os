# Phase 1 Execution Scope Amendment Review

状态：`GOVERNANCE REMEDIATION IMPLEMENTED`

日期：`2026-08-28`

Issue：`#7`

源 `main` baseline：`8ae3f00cb68e63bbeab88a7f53dc7d5ae70a51ff`

分支：`governance/p1-execution-scope-amendment`

## Finding

The deny-by-default Phase 1 WRITE_SCOPE authorized per-operation Evidence but omitted the structured execution-record namespace. P1-O01 correctly stopped before production implementation. The same omission would have blocked P1-O02 through P1-O09.

Classification：`SCOPE_CLOSURE_DEFECT`。This is not architecture expansion and changes no Workflow, Node, Verification, Evidence or Learning semantics.

## Amendment

- globally authorize only `operations/phase-1/executions/**`;
- authorize the exact `operations/phase-1/executions/p1-oXX-*.json` namespace for each P1-O01 through P1-O09;
- keep `operations/phase-1/implementation-receipt.json` exclusively with P1-O09 as the integrated Phase 1 handoff receipt;
- synchronize the human-readable WRITE_SCOPE;
- regenerate exact-byte SHA-256 entries for every changed locked governance file;
- add regression verification for all nine execution-record namespaces, `DENY_BY_DEFAULT`, the broad-scope prohibition and integrated-receipt ownership.

## Authority boundary

```text
Accepted ADR-0001..ADR-0011 changed: NO
Operation Plan semantics changed: NO
VerificationPlan semantics changed: NO
Production Runtime implementation started: NO
P1-O01 implementation declaration: NOT MADE
P1-O01 verification declaration: NOT MADE
Governance remediation declaration: IMPLEMENTED
```

## Resume decision

P1-O01 resume is authorized only after this amendment passes the required protected-PR `verify` check and is merged to protected `main`.

The new implementation baseline is the protected `main` commit containing:

- this review;
- `operations/phase-1/p1-o01-resume-gate.json`;
- the amended WRITE_SCOPE;
- the regenerated Authority Lock.

The existing `phase-1/p1-o01-toolchain-foundation` branch must be recreated or rebased from that exact commit before Issue #6 resumes.
