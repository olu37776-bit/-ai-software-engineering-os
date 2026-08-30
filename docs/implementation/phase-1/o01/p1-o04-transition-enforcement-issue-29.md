# Issue #29 P1-O04 transition enforcement

Status: `IMPLEMENTED — INDEPENDENT VERIFICATION REQUIRED`

This P1-O01 remediation makes the transition from the already verified architecture operation to P1-O04 machine-enforceable without changing ADR-0011 or implementing Policy runtime behavior.

## Enforced boundary

- The sole required `verify` job derives base, head, branch and event from the immutable GitHub event and rejects manual dispatch because it has no independently bound base.
- Git changed paths are read as NUL-delimited raw bytes, decoded as strict UTF-8 and validated as canonical safe repository paths before glob or production-prefix classification.
- M0 independently requires the complete exact base/head/branch/scope-report tuple, proves checkout equality and ancestry, and matches the report path set to the raw Git diff.
- Authority Lock ownership can change only through a prior-Gate-exact governance amendment. Operation execution can refresh only the SHA of a changed operation-scoped asset owned by that operation in the same diff.
- P1-O04 remains blocked until the preliminary amendment, transition enforcement, final exact scope/ownership amendment, their protected-main merges and post-merge checks, and a separate independent resume Gate are all bound in order.

## Final amendment contract

The later amendment must add the 15 exact root/Contract integration paths authorized by Issue #29 and apply exactly three ownership deltas:

- `packages/contracts/planned-contracts.json`
- `packages/contracts/schema-inventory.json`
- `packages/contracts/schema-registry.json`

Each changes from `["P1-O02"]` to `["P1-O02", "P1-O04"]`. The amendment cannot start from this implementation branch; it requires its own prior authorization Gate after this remediation is independently verified, merged, and post-merge qualified.

## Verification

- Focused/adversarial tests: 30 passed.
- Root suite: 18 files / 112 tests passed.
- Architecture suite: 9 tests passed.
- Quality, clean build/test, frozen offline install, M0 14/14, scope 0 violations: PASS.
- `ISSUE29-CI-01` is remediated by installing the same pinned M0 Python dependencies on both quality platforms before the integration suite; a regression assertion locks the versions and step ordering.
- `ISSUE29-CI-02` is remediated by canonical LF hashing for UTF-8 text authorities while preserving raw artifact hashing, plus canonical Git-path rejection tests. CRLF passes; mixed/lone CR and non-canonical paths remain denied.
- `ISSUE29-CI-03` is remediated by using non-NFC paths for cross-platform Node/Python rejection and retaining direct TAB Git-object injection on POSIX, where Git permits construction. Git for Windows' own earlier path denial remains accepted as defense-in-depth rather than a test failure.
- Implementation commit: `f411a8df2eea570f5e95b39f742ea8c6a02b20b6`.
- Implementation tree: `cdf32b7f971a6313c20286cbd3ec32ca30b58f13`.

No VERIFIED claim is made here. Immutable-head GitHub qualification and independent read-only verification remain required.
