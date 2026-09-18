# P2-O01: durable workflow creation

This is the first runnable Phase 2 slice, not completion of Phase 2. It follows the user's final P1 acceptance and explicit instruction to continue mainline implementation. The exact accepted P1 merge is bound in `operations/phase-2/operation.json`; required CI remains mandatory.

## Delivered behavior

`CreateWorkflowRun → WorkflowRunCreated (version 1) → SQLite commit → restart → identical replay`.

The kernel validates the canonical command envelope, supported aggregate/command pair, payload schema authority hash, payload hash and safe expected version before proposing a write. The workflow owner makes a pure decision and folds only canonical event facts into a `CREATED` state. Injected time and IDs keep the transition deterministic.

The internal platform service composes those public packages with the existing dedicated SQLite worker. A single existing journal transaction commits the event, audit fact and command-dedup receipt. Exact retries recover the original stored receipt even across a restart or competing services. Reusing an identity with changed command data is an explicit persistence conflict, not an accepted duplicate. Optimistic concurrency preserves one creation event.

Replay rejects unknown event semantics, incorrect schema or payload hashes, wrong stream identities, duplicate event IDs, noncontiguous versions and invalid creation causation. Returned results also check the stored receipt hash and its exact command-event binding. There is no authoritative in-memory outcome cache.

## Package ownership

| Package              | Responsibility                                                        |
| -------------------- | --------------------------------------------------------------------- |
| `@aseos/contracts`   | Existing canonical schemas, registry and hashing; unchanged authority |
| `@aseos/kernel`      | Generic synchronous admission, transition/replay and journal port     |
| `@aseos/workflow`    | Pure creation decision and WorkflowRun state reducer                  |
| `@aseos/persistence` | SQL and transactions; narrow read-only original-receipt lookup        |
| `@aseos/platform`    | Internal application service and injected clock/IDs                   |

Kernel cannot import persistence, platform or workflow. Workflow cannot import persistence or platform. Dependency checks enforce these boundaries.

## Verification

Run `pnpm kernel:qualify` to build and execute the real public-package tests. They cover deterministic construction/replay, malformed input and tampered authority, immutable input capture, zero-write rejection, restart dedup, changed-identity conflict, competing SQLite workers, a duplicate between lookup and replay, receipt corruption and an audit-insert failure that rolls back the event and dedup record.

`pnpm quality` includes this qualification and all existing checks. P2 scope dispatch separately validates the accepted P1 main merge, immutable P1 authority, exact operation record and deny-by-default paths. M0 independently recomputes the P2 scope result, so a supplied PASS record is not trusted by itself.

Windows release assembly now includes the three newly required runtime packages, persistence migration assets and the original schema registry plus its authority files under `app/authority`. The packaged workflow probe uses the bundled Node executable with development tool discovery removed; it explicitly passes that authority root to `loadContractRegistry` and `PersistenceWorker.open`, creates and reopens SQLite, then checks exact duplicate recovery. No runtime schema download or host dependency is needed.

## Boundaries and next construction

- This is an internal application service, not a new externally authorized command endpoint. Existing Control API/CLI permissions are unchanged.
- State is only `CREATED`; no scheduling, node dispatch, leases, retries, timeout or cancellation is claimed.
- The existing creation event does not contain `inputArtifactRef`. This slice does not pretend that replay recovers that command-only field or that a workflow definition has been resolved.
- Worker results, inbox/outbox delivery and projection checkpoints are not yet one atomic application transaction.
- The non-production and PROCESS_RESTRICTED limitations accepted in P1 still apply. No real model, private Workspace, GBrain, Learning or Coverage implementation is included.

Next mainline slice is atomic worker-result admission and event/outbox/inbox integration, with explicit new contract activation where genuinely required. Do not merge unrelated design branches as an implementation shortcut.
