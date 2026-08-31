# P1-O05 node:sqlite authority-storage qualification

Status: `IMPLEMENTED — PENDING INDEPENDENT VERIFICATION`

Qualified code subject: `e157d7888262ef5484273cca35b5c21df34f9d01`
(tree `088b863ab188234b3bda5deedd16ba7c75d5d478`) on PR #63. Exact-subject
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
original persisted receipt. Command IDs and command idempotency pairs are checked
as one canonical identity set. Outbox task IDs and outbox idempotency pairs are
checked transactionally before journal mutation. Any non-exact reuse fails with
`PERSISTENCE_IDEMPOTENCY_CONFLICT` instead of leaking a SQLite uniqueness error.

Connection qualification explicitly attests WAL, FULL synchronous durability,
foreign keys, trusted schema off, non-zero busy timeout, defensive mode,
extension loading disabled, double-quoted string literals disabled, bounded
SQLite limits, prepared parameter binding, and a runtime authorizer that denies
ATTACH, schema mutation, and extension loading. Tables are STRICT and the Event
journal has append-only update/delete triggers.

Migration `001-initial.sql` is ordered and checksum-bound by
`migrations/manifest.json`. Before an existing authority database can run any
migration, startup compares its complete governed `sqlite_schema` with the exact
schema produced by the authorized migration and requires the applied migration
history to equal the ordered manifest set. Unknown future versions and malformed
or partial tables fail closed before any migration write. `COMPATIBLE` is
reported only after those checks and `quick_check` pass. Backup uses SQLite
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
- typed command-ID, command-pair, outbox-task, and outbox-pair conflicts;
- unknown migration-version and incompatible-schema startup rejection;
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
