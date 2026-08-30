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
- `ISSUE29-CI-02` is remediated by canonical LF hashing for UTF-8 text authorities while preserving raw artifact hashing, plus Git-object construction of control-character attack paths on every platform. CRLF passes; mixed/lone CR and non-canonical paths remain denied.
- Implementation commit: `1bf4de360f18c1daa08b421243bc62790689bc21`.
- Implementation tree: `199b30db51da5a70a713c98b0a1e2c97e6e2ccf6`.

No VERIFIED claim is made here. Immutable-head GitHub qualification and independent read-only verification remain required.
