# Phase 1 review remediation and integrated completion

Status: ACTIVE / user-authorized; Issue #82. Reviewed baseline: `3c387f5f196ddfae8e8989710d5a55f9def472a7`.

The user authorized remediation of the comprehensive review followed by completion of the entire Phase 1. This document coordinates existing operation scopes; it does not modify accepted ADRs or frozen operation/verification/scope authority. The review is `docs/reviews/phase-1-comprehensive-review-2026-09-08.md`.

## Execution order and WRITE_SCOPE

Every row uses exactly the existing matching operation in `operations/phase-1/write-scope.json`, its allowed execution/Evidence/document paths, and a new `phase-1/p1-oNN-review-remediation-issue-82` branch from the current protected main. No mixed-operation implementation diff. Refresh only authorized operation-scoped hashes when the corresponding assets actually change.

| Order | Operation | Findings and required result |
| --- | --- | --- |
| 0 | P1-O09 preparation | Publish reviewed facts, this plan and current status as PARTIAL. This is review/handoff preparation; no integrated-completion claim. |
| 1 | P1-O01 | R01/R02/R16: unique required verify must require applicable real quality/packaging results; validate actual receipts; exact checkout Evidence. R14: root tsc authority build must also assemble mandatory runtime assets. |
| 2 | P1-O02 | R06/R09/R10: reject invalid canonical input, preserve schema composition in generated types, validate actual calendar timestamps. |
| 3 | P1-O03 | R08: all existing workspace apps have explicit architecture policies and normal-entry negative tests. |
| 4 | P1-O04 | R03: unresolved references and incompatible operands fail closed, including invalid DENY plus valid ALLOW. |
| 5 | P1-O05 | R04/R05/R11: canonical payload admission; valid fixture Contracts; separate invalid configuration/busy from corruption; do not hide an existing truncated DB. |
| 6 | P1-O06 | R07/R12/R13: exclusive runtime ownership, bounded input cancellation/resource release, correct streaming UTF-8 and route-status binding. |
| 7 | P1-O07 | WR01: real Windows host-death and bridge lifecycle qualification; repair any no-orphan violation without claiming stronger sandbox levels. |
| 8 | P1-O08 | R15: positively parsed loopback literals and negative hostname probes; exact self-contained Windows artifact qualification. |
| 9 | P1-O09 finalization | Real implementation receipt, exact Evidence index, independent receipt and P1-V00–V10 Gate; synchronized current docs and protected-main post-merge qualification. |

## Required verification

Each finding needs a regression through its public/normal entry: the reproduced invalid case is rejected correctly and valid behavior still succeeds. Gate regressions must execute the actual verifier/workflow binding rather than duplicate implementation logic. Persistence negatives must prove zero unintended journal/outbox/receipt/audit mutation and preserve existing healthy facts. Concurrency qualification must assert at most one owner; Windows tests must measure actual process lifetime. Skips on Linux do not replace Windows Evidence.

Implementation records declare at most IMPLEMENTED. A distinct read-only verification pass operates on an immutable commit without remediation, records actual verifier/runner identity and Evidence, and must not reuse previous HEAD conclusions. If a verification pass finds a defect, return to implementation and create a new subject; do not relabel the same pass VERIFIED.

Before merge: operation scope/authority PASS, all applicable quality and Windows qualification PASS, independent verification evidence bound to exact subject. Merge method is merge with expected head SHA. After merge: repeat required/quality/packaging checks at exact protected main. Accepted ADR changes, scope ownership changes or unavailable required independent/security verification remain explicit blockers, never bypasses.

## State and evidence paths

Implementation evidence: `operations/phase-1/evidence/oNN/p1-oNN-review-remediation-issue-82.json`.
Execution: `operations/phase-1/executions/p1-oNN-review-remediation-issue-82.json`.
Implementation document: `docs/implementation/phase-1/oNN/review-remediation-issue-82.md`.
Final review: `docs/reviews/phase-1-integrated-verification-issue-82.md`.
Final index: `operations/phase-1/evidence/o09/p1-v10-integrated-evidence-index-issue-82.json`.
Independent receipt: `operations/phase-1/evidence/o09/p1-v10-independent-verification-issue-82.json`.
Final implementation receipt: `operations/phase-1/implementation-receipt.json`.

The current source of execution progress is the latest operation-specific records plus `docs/roadmap/progress-status.md`; frozen planning status is not rewritten. Phase 1 remains REWORK until all R01–R16 and WR01 obligations are resolved and the final Gate passes. Phase 2, Learning runtime and private local/GBrain integration are not started here; the separate documentation-only Issue #81 is not changed by this operation.
