# P1-O07 Windows PROCESS_RESTRICTED

Status: implemented; immutable independent verification pending.

## Authority and boundary

P1-O07 implements the Phase 1 `PROCESS_RESTRICTED` provider accepted by ADR-0010 and released by the independent Issue #71 start Gate. The provider supplies Windows Job Object lifecycle and resource containment. It is not a security sandbox and does not claim filesystem, registry, or network denial.

The operation is fail closed: a task requiring `PROCESS_RESTRICTED` is blocked when the provider probe is unavailable, and a request for a stronger isolation level is never downgraded.

## Implementation

The task-facing request accepts a `toolRef` plus typed argv, a canonical staging root, an explicit environment allowlist, bounded staged inputs, and mandatory CPU, memory, process-count, wall-clock, stdout, and stderr budgets. A host-owned `TrustedToolCatalog`, supplied separately from task data, resolves that reference to the canonical executable path, tool version, and executable SHA-256. Task JSON cannot inject or override any of those authorities. Shell and script interpreters are outside this operation's capability and are rejected even when copied or renamed: the bridge checks the locked executable's PE identity as well as its digest before process creation.

On Windows, a fixed PowerShell-hosted Win32 bridge performs the lifecycle sequence:

1. open and lock the catalog-selected executable, verify its SHA-256 and PE identity, then create controlled stdin/stdout/stderr handles and a per-task Job Object;
2. configure kill-on-close and resource limits;
3. call `CreateProcessW` with `CREATE_SUSPENDED` and an explicit environment block;
4. assign the suspended process to the Job Object before calling `ResumeThread`;
5. monitor cancellation, time and resource usage, bound output, and terminate the entire Job Object at completion;
6. wait for zero active processes and return provider/version-aligned `IsolationEvidence`.

The bridge process itself receives only the Windows variables needed to start PowerShell. The target receives only caller-provided variables whose names also appear in the request allowlist. The request file contains no inherited Runtime or provider credentials.

## Capability and downgrade behavior

The capability probe executes the fixed Win32 path; file presence alone is not sufficient. Non-Windows platforms, missing bridge prerequisites, and failed probes return canonical unavailable capability reports. The Worker blocks when `PROCESS_RESTRICTED` is required but unavailable. Requests requiring `OS_SANDBOXED`, `CONTAINER_ISOLATED`, or `REMOTE_ISOLATED` are also blocked because P1-O07 does not implement those levels; they are never routed downward to the Job Object provider.

An available report may claim process-tree lifecycle and resource-budget enforcement. Every report and execution evidence fixes these fields to false: network access denied, filesystem access denied, registry access denied, and security sandbox. This is the residual-risk boundary accepted by ADR-0010.

## Qualification

P1-V08 uses a pinned, runtime-compiled standalone `.exe` test fixture rather than opening a shell capability. Windows tests cover suspended-create-before-assignment behavior, child and grandchild cleanup, timeout and cancellation, CPU/memory/process-count/output budgets, environment secret exclusion, staged Unicode/space paths, traversal and executable-hash rejection, canonical evidence validation, and no downward fallback. Non-Windows tests require an unavailable result and prove that no host fallback executes.

The exact qualification results and immutable implementation commit/tree bindings are recorded in `operations/phase-1/evidence/o07/p1-v08-isolation.json`. This implementation claim remains `IMPLEMENTED`; only a separate read-only Gate bound to the published Evidence head may declare it independently verified.
