# Issue #39 recovery-safe final Gate sequencing

Status: `IMPLEMENTED`

Issue #29 transition enforcement originally required the final amendment authorization Gate merge to be a direct child of transition-enforcement main `2336fa3faa9123512f85091f61c4465d64e18233`. Legitimate Issue #33, #35, and #37 recovery merges made that state unreachable even though the transition commit remained on protected-main ancestry.

This remediation keeps the Gate fail-closed while separating two facts:

- the Gate merge has exactly two parents and its second parent is the immutable reviewed Gate head;
- its first parent is the exact authorization base declared by the Gate, and the VERIFIED transition-enforcement merge must be an ancestor of that base.

The final amendment continues to require an unused issue-specific authorization path and the exact branch `governance/p1-o04-final-scope-authority-amendment-issue-<trackingIssue>`. The five amendment paths, three ownership deltas, DENY_BY_DEFAULT enforcement, and unique `verify` producer are unchanged.

## Immutable implementation

- Base: `0fe24ef8b2cb4aaaecfb330bf41ebbfe0f202057`
- Code commit: `be4ee4255bcf696ff338761694e880db4f9bed23`
- Code tree: `02668446f8ed4e40422ad77bb97c341fa5f586c2`
- PR: #40

The regression fixture inserts a protected-main recovery merge between transition enforcement and the final authorization Gate. The previous direct-parent logic fails this fixture; the remediated verifier passes only after proving exact Gate parents, exact `authorizationBase`, and transition ancestry.

## Qualification

- WRITE_SCOPE preflight: `OPERATION_EXECUTION / P1-O01 / DENY_BY_DEFAULT / 0 violations`
- Required `verify`: run `33330414982`, PASS
- Quality: run `33330414830`, PASS
- Linux: job `99307899836`, PASS
- Windows: job `99307899711`, PASS
- Aggregator: job `99308280646`, PASS
- Root: 19 files / 125 tests
- Architecture: 9 tests
- Clean build/test: PASS

This is not a VERIFIED declaration. Independent immutable-head verification, exact merge, protected-main post-merge qualification, and Issue #35 historical dispatch remain required. No P1-O04 implementation or final amendment Gate has started.
