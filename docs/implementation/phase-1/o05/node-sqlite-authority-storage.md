# P1-O05 node:sqlite authority-storage qualification

Status: `IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Qualified code subject: `fd0eb489c231d8ff27c26c87e22b95a7c6db0785`
(tree `b573573c3f747ae8cea1a45cbb425668cb074109`) on PR #63. Exact-subject
M0, Linux, Windows, and the aggregate quality check passed before Evidence
publication.

P1-O05 implements the ADR-0008 qualification boundary with the exact Node.js
24.19.0 built-in `node:sqlite` driver. All driver calls and synchronous database
work execute inside a dedicated `PersistenceWorker` thread. The public
`@aseos/persistence` entry exports only structured Contract-shaped methods and
never exports SQL rows, table names, `DatabaseSync`, statements, or driver types.

The authority database is `<data-root>/state/aseos.db`. A bounded parent queue
feeds a serial worker queue. Each append uses one `BEGIN IMMEDIATE` transaction
covering the Event journal, command receipt, outbox, and audit facts. Expected
versions, Event payload hashes, outbox payload hashes, command identities, and
idempotency scope are checked before commit. Duplicate commands return the
original persisted receipt; conflicts fail with typed errors.

Connection qualification explicitly attests WAL, FULL synchronous durability,
foreign keys, trusted schema off, non-zero busy timeout, defensive mode,
extension loading disabled, double-quoted string literals disabled, bounded
SQLite limits, prepared parameter binding, and a runtime authorizer that denies
ATTACH, schema mutation, and extension loading. Tables are STRICT and the Event
journal has append-only update/delete triggers.

Migration `001-initial.sql` is ordered and checksum-bound by
`migrations/manifest.json`. Startup runs `quick_check`; backup uses SQLite
online backup and full `integrity_check`. An existing database that cannot be
opened or checked is moved to a quarantine path and is never replaced with an
empty database. An exclusive recovery-required marker is written before the
move; every later normal open checks it before SQLite access and fails closed
until an explicit recovery action.

The migration SQL is marked `-text` by the package-local `.gitattributes` so
Git cannot rewrite checksum-bound bytes on Windows. A real Git-filter regression
uses `core.autocrlf=true`, proves SQL checkout bytes equal the canonical blob,
and proves an adjacent JSON control does receive CRLF conversion. Checksum
semantics remain raw-byte and fail closed. The loader hashes the exact Buffer
before a separate fatal UTF-8 decode; tests reject both raw drift and malformed
UTF-8 with an otherwise matching raw hash.

Inbox replay is exact across `resultId`, `taskId`, and `payloadHash`. Either ID
reused with a different counterpart is an idempotency conflict even when the
payload hash is identical.

P1-V06 qualification covers:

- Event, command receipt, outbox, and audit atomicity;
- exact idempotent replay and optimistic-concurrency rejection;
- inbox deduplication and monotonic projection checkpoints;
- worker termination before and after commit, WAL recovery, and database locks;
- online backup/restore and corruption quarantine;
- extension, ATTACH, runtime DDL, and SQL-injection denial;
- dedicated-worker event-loop responsiveness;
- 10,000 Event replay and 100,000 Event recovery;
- Node 24.19.0 / SQLite 3.53.3 runtime attestation.

Seven Phase-1 persistence Contracts are activated together with the registry,
inventory, type bindings, and generated declarations. `LeaseRecord` remains
planned for Phase 2. No scheduler, Workflow, Node Runtime, terminal transition,
alternate driver, or fallback persistence semantics are introduced.
