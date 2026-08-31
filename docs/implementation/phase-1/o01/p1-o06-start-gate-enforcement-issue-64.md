# P1-O06 start Gate enforcement

Issue #64 transition enforcement is owned by P1-O01 and starts from protected main `d05c7d85fcf281453329cc2e2f561a1031872376`. That baseline contains the independently verified P1-O06 scope and Authority amendment merged at `4d0aedd2a9b696e1ebea8b49ec60b487449583c1`, followed by the verified Windows fixture-copy remediation.

The operation-aware scope verifier requires P1-O06 to load one fixed independent Gate from `operations/phase-1/evidence/o01/p1-o06-start-after-issue-64-independent-gate.json`. Missing, malformed, non-PASS, self-remediated or scope-expanding Gate content fails closed.

The Gate must bind Issue #64, the exact authorization Gate, the scope/Authority amendment implementation tree, reviewed head and protected-main merge, plus this transition-enforcement implementation tree, reviewed head and protected-main merge. The verifier replays merge parents and ancestry, the exact five-file amendment diff, the 14 P1-O06 scope additions, the three Authority ownership deltas and the amendment Evidence.

The enforcement is routed through `verifyOperationStartGate()` without changing the existing P1-O02, P1-O04 or P1-O05 Gate policies. Policy tests cover the fixed Gate identity and all closed transition bindings. An executable temporary-repository test proves that both an absent Gate and a malformed Gate fail closed before any P1-O06 implementation mutation can pass operation-aware WRITE_SCOPE verification.

This change does not start P1-O06, activate the six planned Control API Contracts, implement a production Workflow, Node Runtime or Kernel transition, change an accepted ADR, expand Phase 1 Runtime semantics, or create a second required `verify` producer. P1-O06 remains blocked until a separate independent Gate is exactly merged and its protected-main post-merge checks pass.
