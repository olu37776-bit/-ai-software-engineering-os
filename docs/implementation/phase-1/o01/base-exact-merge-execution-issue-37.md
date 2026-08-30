# Issue #37 base-exact merge execution selection

Status: `IMPLEMENTED — INDEPENDENT VERIFICATION REQUIRED`

Issue #35 changed its current P1-O01 execution record and corrected a historical P1-O01 execution record in the same authorized diff. PR-head scope selected the current record by implementation branch, but protected-main merge scope rejected all multi-record diffs before considering that exactly one record declared the exact merge event base.

This remediation makes the protected-main selection equally exact:

- Select the unique changed execution record whose `baseCommit` equals the event base/merge first parent.
- Validate every changed path, including additional historical records, through the selected operation's existing DENY_BY_DEFAULT scope and Authority Lock.
- Reject multiple changed records with zero event-base matches.
- Reject multiple event-base matches.
- Preserve the existing mismatch rejection for one changed record with the wrong base.
- Reject an execution path owned by another operation.
- Preserve branch execution, governance amendment, evidence-only and non-operation paths.
- Keep `.github/workflows/m0-independent-verify.yml#verify` as the unique required-check producer.

## Verification

- Write preflight: `OPERATION_EXECUTION / P1-O01 / DENY_BY_DEFAULT / 25 immutable / 0 violations`.
- Scope-policy suite: 28/28, including three selector regressions.
- Root suite: 19 files / 125 tests.
- Architecture suite: 9/9.
- M0 `33329183948`, Linux `99304581334`, Windows `99304581285`, aggregator `99305034216`: PASS.
- Quality, clean build/test and frozen install: PASS.
- Qualified implementation: `5be297241f1e51543a5a82ca391c14460a5a5696`.
- Implementation tree: `7352f2dbaa069b7777088d172ebd5828e73a899b`.

No VERIFIED claim is made. Immutable Evidence-head qualification, independent read-only verification, exact merge and protected-main post-merge recovery remain required.
