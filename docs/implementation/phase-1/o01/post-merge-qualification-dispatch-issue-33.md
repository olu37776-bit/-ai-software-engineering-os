# Issue #33 exact protected-main post-merge qualification dispatch

Status: `IMPLEMENTED — INDEPENDENT VERIFICATION REQUIRED`

The Issue #29 transition-enforcement merge at `2336fa3faa9123512f85091f61c4465d64e18233` became protected `main`, but GitHub produced no workflow run or commit status for that merge. Because an implementation self-check cannot replace post-merge qualification, the transition remains unverified until the exact historical merge is exercised from protected `main`.

## Fail-closed dispatch boundary

- Only a workflow definition on the current protected `main` may control recovery.
- The caller supplies one lower-case 40-character target SHA; no caller-controlled base is accepted.
- The target checkout must equal the requested SHA, and the independently fetched `origin/main` must equal the workflow controller commit.
- The target must be a two-parent merge on the current protected-main first-parent history.
- The scope base is derived from the target's first parent; the target is the scope head and `main` is the branch.
- The current-main controller is deleted before operation-aware scope, M0, quality, and clean build/test execute from the historical target checkout.
- The unique required check remains `.github/workflows/m0-independent-verify.yml#verify`.

## Qualification

- Exact resolver and workflow integration tests: 10 passed.
- Root suite: 19 files / 122 tests passed.
- Architecture suite: 9 tests passed.
- Quality, clean build/test, frozen offline install, M0 14/14, scope 0 violations: PASS.
- Implementation commit: `983bf2e3060bab0b7f360d9ce163534fc2a70cb8`.
- Implementation tree: `dd2f8b301334cd025bb643e7dcfdb7fc6334e5b9`.

No VERIFIED claim is made here. Immutable-head CI and independent read-only verification are required before merge. After exact merge, manual dispatch must independently qualify both that new merge and historical transition-enforcement merge `2336fa3faa9123512f85091f61c4465d64e18233`.
