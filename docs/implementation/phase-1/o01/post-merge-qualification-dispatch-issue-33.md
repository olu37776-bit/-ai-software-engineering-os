# Issue #33 exact protected-main post-merge qualification dispatch

Status: `VERIFIED — OBSERVABILITY CORRECTED BY ISSUE #35`

Issue #33 added a fail-closed recovery path for qualifying an exact historical protected-main merge. The implementation remains valid, but its original Evidence incorrectly concluded that transition-enforcement merge `2336fa3faa9123512f85091f61c4465d64e18233` had no workflow runs. The connector used for that observation returns only pull-request-triggered runs; the complete GitHub Actions collection proves two push runs existed from merge time and both passed.

## Fail-closed dispatch boundary

- Only a workflow definition on the current protected `main` may control recovery.
- The caller supplies one lower-case 40-character target SHA; no caller-controlled base is accepted.
- The target checkout must equal the requested SHA, and the independently fetched `origin/main` must equal the workflow controller commit.
- The target must be a two-parent merge on the current protected-main first-parent history.
- The scope base is derived from the target's first parent; the target is the scope head and `main` is the branch.
- The current-main controller is deleted before operation-aware scope, M0, quality, and clean build/test execute from the historical target checkout.
- The unique required check remains `.github/workflows/m0-independent-verify.yml#verify`.

## Implementation verification

- Qualified implementation: `983bf2e3060bab0b7f360d9ce163534fc2a70cb8`.
- Implementation tree: `dd2f8b301334cd025bb643e7dcfdb7fc6334e5b9`.
- Independently reviewed head/tree: `a8c6e0aa33d947de744987047e85555794684f75` / `4ac573bc5a2313c20fbb1d0c8ccc82b4561539e9`.
- Independent review `5061534201`: PASS.
- Exact resolver tests 10/10; root 19 files / 122 tests; architecture 9/9; M0 14/14; Linux, Windows and aggregator: PASS.
- Protected-main merge: `d98c92ed2d54b25e1e2d22031e73261846dd14a4`.
- Post-merge M0 `33327152584` and quality `33327152622`: PASS.
- Post-merge Linux `99299209296`, Windows `99299209173`, aggregator `99299635705`: PASS.

## Historical transition qualification

The complete Actions collection binds the exact historical transition merge without requiring replay:

- M0 run `33325868577`, job `99295763471`: PASS, base `69804341c21c220863389571d9b5be8796eb0382`, head `2336fa3faa9123512f85091f61c4465d64e18233`, `OPERATION_MERGE / P1-O01`, 14/14.
- Quality run `33325868598`: PASS.
- Linux `99295763876` and Windows `99295763749`: PASS, 18 files / 112 tests, architecture 9/9 and clean rebuild.
- Aggregator `99296178483`: PASS.

Manual dispatch is therefore not required for either already-qualified merge. It remains an implemented fail-closed recovery capability for a future exact protected-main merge whose complete Actions collection genuinely lacks qualification.
