# P1-O07 start Gate enforcement

Issue #71 transition enforcement is owned by P1-O01 and starts from protected main `ce7373c980141ba65e1ba9b65592fdbedc6029b8`. That baseline contains the independently authorized and verified P1-O07 scope and Authority amendment, including the exact repository-integration and Contract-activation paths required by the Windows `PROCESS_RESTRICTED` implementation.

The operation-aware scope verifier requires P1-O07 to load one fixed independent Gate from `operations/phase-1/evidence/o01/p1-o07-start-after-issue-71-independent-gate.json`. Missing operation context and missing, malformed, non-PASS, self-remediated or scope-expanding Gate content fail closed.

The Gate must bind Issue #71, the exact authorization Gate, the scope/Authority amendment implementation tree, reviewed head and protected-main merge, plus this start-Gate enforcement implementation tree, reviewed head and protected-main merge. The verifier replays merge parents and ancestry, the exact five-file amendment diff, the 13 P1-O07 scope additions, the three Authority ownership deltas and the amendment Evidence.

The enforcement is routed through `verifyOperationStartGate()` without changing the existing P1-O02, P1-O04, P1-O05 or P1-O06 Gate policies. Policy tests cover the fixed Gate identity and all closed transition bindings. An executable temporary-repository test proves that missing operation context and both an absent Gate and a malformed Gate fail closed before any P1-O07 implementation mutation can pass operation-aware WRITE_SCOPE verification.

This change does not start P1-O07, activate the three planned isolation Contracts, implement a production Worker or Windows Adapter, change an accepted ADR, expand Phase 1 Runtime semantics, or create a second required `verify` producer. `PROCESS_RESTRICTED` remains a Windows lifecycle and resource-containment boundary rather than a security sandbox: filesystem, registry and network isolation claims remain false, and no `HOST_UNRESTRICTED` downgrade is authorized. P1-O07 remains blocked until a separate independent Gate is exactly merged and its protected-main post-merge checks pass.
