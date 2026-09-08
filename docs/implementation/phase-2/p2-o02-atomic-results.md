# P2-O02: atomic worker-result journal

This slice adds a durable storage capability, not Node completion semantics or a public worker endpoint. It follows the qualified P2-O01 main merge, pinned in its own operation and executable scope policy. Unbound baseline records cannot pass the gate.

## Behavior

`scheduled outbox task → result admission → one SQLite transaction → recorded event + accepted inbox + audit + original receipt`.

`PersistenceWorker.commitResult` accepts the new `ResultJournalAppendBatch` combination contract. It contains the existing journal batch, full `SideEffectResultEnvelope` and an optional real projection checkpoint. All old schema files and registry entries remain unchanged.

Admission checks the nested schemas and hashes, result time/attempt validity, deterministic result identity and a single `SideEffectResultRecorded` event containing the full result. The transaction verifies that the task really exists in durable outbox, matches the execution/attempt/correlation, and belongs to the same stream according to its original scheduling receipt. A caller's aggregate ID alone is not sufficient authority.

Journal, generated outbox tasks, accepted inbox, audit, original command receipt and optional checkpoint are committed together under one `BEGIN IMMEDIATE`. A failure rolls all of them back. The original scheduling task remains pending after a rolled-back result. Exact redelivery after a lost response or restart returns the original stored receipt, never an invented duplicate receipt. A second result for the same task or incompatible reused identity is rejected.

`listPendingOutboxTasks` returns complete task envelopes still awaiting an accepted result. Recovery counts use the same predicate. `UNKNOWN` is a recorded result fact, not a success claim or permission to automatically repeat an external side effect.

## Compatibility and boundaries

No database migration is needed: the full result is persisted in the event journal, its envelope hash is stored in the existing inbox, and the existing command-receipt table retains the original outcome. The historical v1 migration SQL, schema validation, backups and existing APIs remain intact. A legacy inbox without a corresponding atomic result receipt is a conflict, not evidence that the new transaction completed.

The existing WorkflowRun reducer remains creation-only. It is not extended to accept this event as a Node success/failure transition. Scheduling, leases, business retries, timeout/cancellation and worker transport/Policy integration remain subsequent work. The storage method is internal and does not grant a caller external execution permission.

The new contract is an additive activation. Required scope verification checks that old schemas, registry entries, inventory/type ownership and example cases are preserved; it permits only the named addition. M0 independently recomputes that gate before accepting the current metadata hashes. The frozen P1 authority lock itself is not rewritten.

## Qualification

`pnpm result-journal:qualify` builds public packages and runs real SQLite transaction/restart/concurrency and fault tests. `pnpm quality` also includes this suite alongside all existing checks. Verification covers zero-write rejection, duplicate recovery, independent competing workers, journal/audit/checkpoint rollback and termination before commit. Required hosted checks and exact protected-main qualification remain mandatory for declaring this slice complete.

The required Windows package suite also exercises result submission using only the bundled runtime and packaged persistence/authority files: schedule a task, reopen storage, atomically accept its result, reopen again, recover the original receipt and verify that no accepted task remains pending. Its temporary data directory is independent of the development checkout.

This is a non-production foundation and does not change the accepted PROCESS_RESTRICTED limitations. It does not complete the whole Phase 2 roadmap.
