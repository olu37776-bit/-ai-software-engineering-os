# Phase 1 Windows qualification fixture repair — Issue #82

Status: PARTIAL / implementation remediation. This is a new verification subject, not an independent Gate or a relabeling of failed runs.

The O07 protected-main qualification at `96051e9aa26b80decb410a411dfb7fbd0981714d` and O08 PR HEAD `b79fd28ab8e9e761936cf88ae5524625ef86d904` failed on actual Windows runners. The root/child fixture observed `grandchild.pid` before the child closed its writer, and `File.ReadAllText` threw `IOException`. Host death had not yet been induced. Registry tests also exceeded their unchanged 10-second test budget while repeatedly copying operation execution and evidence history.

The native fixture now writes each PID/readiness marker to a unique temporary file, closes it and publishes it with same-directory `File.Move`. The root reads the published PID once. The host-only kill and five-second bridge/root/child/grandchild exit assertions remain unchanged. Contract fixtures retain the full canonical contract assets and exactly the external authorities declared by the real registry, avoiding unrelated execution/Evidence copies. No negative assertion or test deadline is weakened.

A cross-component regression also proves invalid sparse JSON leaves zero events, commands, outbox and audit records, then accepts a valid journal commit. O09 owns these verification fixtures/tests under the frozen WRITE_SCOPE; runtime implementation and Authority are unchanged.

Original failed check snapshots and full job logs are retained under `operations/phase-1/evidence/o09/issue-82/history`. Their failures remain failures. The new immutable PR and its protected-main merge must pass full hosted qualification before the remaining operation sequence continues. The failed original main is superseded by this repair; it is never recorded as an all-PASS post-merge execution.
