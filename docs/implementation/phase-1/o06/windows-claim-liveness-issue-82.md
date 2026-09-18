# Windows claim-scan liveness repair — Issue #82

Status: IMPLEMENTED / final hosted qualification pending. This is an O06 runtime repair, not an independent Gate.

A real Windows qualification of `43ea7961f2595a30c7d29e1b3e7938e34cfd29aa` observed a contention round with no successful owner. The original assertion omitted each rejection and its filesystem cause, so this observation alone does not identify the exact errno. The O09 fixture PR adds diagnostic context without changing the assertion.

A controlled fault through the actual `acquireRuntimeLock` entry reproduced a concrete gap: when a departing claim returns a Windows delete-pending access error, the scanner immediately aborts even though an uncontested election is now possible. The original EPERM case fails with `CONTROL_RUNTIME_LOCK_FAILED`.

The scanner now retries a complete observation on Windows EPERM, EACCES or EBUSY, using a monotonic one-second budget. It never removes or omits an unreadable live claim. If the failure persists, acquisition still fails closed and only its own candidate is removed. Non-Windows errors, malformed identities/tickets, existing-owner detection and the bakery ordering are unchanged.

The isolated fault cases cover all three transient error codes, exactly one resulting owner, rejection of a second owner and clean release. A permanently unreadable live claim remains present, leaves no authoritative lock metadata and prevents acquisition. Local build/lint and all 12 affected fault/competition/process-recovery/deadline/SSE tests pass. The injected Windows errors on Linux are explicitly simulation, not native platform evidence; the final immutable branch and protected main must run the real Windows regressions.
