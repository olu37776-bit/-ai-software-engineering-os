import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { backup, constants, DatabaseSync } from "node:sqlite";
import { parentPort, workerData } from "node:worker_threads";

import {
  canonicalJson,
  canonicalJsonSha256,
  type CommandDedupRecord,
  type DomainEventEnvelope,
  type InboxRecord,
  type JournalAppendBatch,
  type OutboxRecord,
  type PersistenceCommitReceipt,
  type ProjectionCheckpoint,
  type StateSchemaManifest,
} from "@aseos/contracts";

type PersistenceErrorCode =
  | "PERSISTENCE_BUSY"
  | "PERSISTENCE_CLOSED"
  | "PERSISTENCE_CONTRACT_INVALID"
  | "PERSISTENCE_CORRUPTION"
  | "PERSISTENCE_IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_MIGRATION_MISMATCH"
  | "PERSISTENCE_OPTIMISTIC_CONCURRENCY"
  | "PERSISTENCE_QUEUE_FULL"
  | "PERSISTENCE_SECURITY_CONTROL_FAILED"
  | "PERSISTENCE_STORAGE_FAILURE"
  | "PERSISTENCE_WORKER_EXITED";

type WorkerConfiguration = Readonly<{
  dataRoot: string;
  busyTimeoutMs: number;
}>;

type WorkerRequest = Readonly<{
  id: number;
  kind: string;
  payload: unknown;
}>;

type SerializedError = Readonly<{
  code: PersistenceErrorCode;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}>;

type MigrationManifest = Readonly<{
  schemaVersion: "1.0.0";
  databaseSchemaVersion: number;
  migrations: readonly Readonly<{
    version: number;
    name: string;
    path: string;
    sha256: string;
  }>[];
}>;

type JsonRecord = Record<string, unknown>;

const port = parentPort;
if (port === null) throw new Error("Persistence worker requires a parent port");

const configuration = workerData as WorkerConfiguration;
const databasePath = resolve(configuration.dataRoot, "state", "aseos.db");
let database: DatabaseSync | undefined;
let manifest: MigrationManifest | undefined;
let writeLockHeld = false;
let crashTransactionArmed = false;

class InternalPersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    code: PersistenceErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "InternalPersistenceError";
    this.code = code;
    this.details = details;
  }
}

function asRecord(value: unknown, context: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      `Expected row object for ${context}`,
    );
  }
  return value as JsonRecord;
}

function requiredString(record: JsonRecord, key: string, context: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      `Expected ${context}.${key} to be a string`,
    );
  }
  return value;
}

function requiredSafeInteger(record: JsonRecord, key: string, context: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      `Expected ${context}.${key} to be a safe integer`,
    );
  }
  return value;
}

function parseJson<T>(value: unknown, context: string): T {
  if (typeof value !== "string") {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      `Expected canonical JSON text for ${context}`,
    );
  }
  try {
    return JSON.parse(value) as T;
  } catch (error: unknown) {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      `Invalid canonical JSON in ${context}`,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function db(): DatabaseSync {
  if (database === undefined) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CLOSED",
      "SQLite connection is not available",
    );
  }
  return database;
}

function serializeError(error: unknown): SerializedError {
  if (error instanceof InternalPersistenceError) {
    return error.details === undefined
      ? { code: error.code, message: error.message }
      : { code: error.code, message: error.message, details: error.details };
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("locked") || lower.includes("busy")) {
    return { code: "PERSISTENCE_BUSY", message };
  }
  return { code: "PERSISTENCE_STORAGE_FAILURE", message };
}

function translateSqliteError(error: unknown): InternalPersistenceError {
  if (error instanceof InternalPersistenceError) return error;
  const serialized = serializeError(error);
  return new InternalPersistenceError(serialized.code, serialized.message, serialized.details);
}

async function fileExistsWithBytes(path: string): Promise<boolean> {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function quarantineDatabase(): Promise<string | undefined> {
  if (!(await fileExistsWithBytes(databasePath))) return undefined;
  const suffix = new Date().toISOString().replaceAll(/[^0-9]/gu, "");
  const quarantinePath = `${databasePath}.corrupt-${suffix}`;
  await rename(databasePath, quarantinePath);
  for (const sidecar of ["-wal", "-shm"]) {
    const source = databasePath + sidecar;
    if (await fileExistsWithBytes(source)) await rename(source, quarantinePath + sidecar);
  }
  return quarantinePath;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function quickCheck(connection: DatabaseSync, pragma: "quick_check" | "integrity_check"): "ok" {
  const rows = connection.prepare(`PRAGMA ${pragma}`).all() as unknown[];
  if (rows.length !== 1) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CORRUPTION",
      `SQLite ${pragma} returned ${String(rows.length)} rows`,
    );
  }
  const row = asRecord(rows[0], pragma);
  if (row[pragma] !== "ok") {
    throw new InternalPersistenceError("PERSISTENCE_CORRUPTION", `SQLite ${pragma} failed`, {
      rows,
    });
  }
  return "ok";
}

function runTransaction<T>(action: () => T): T {
  const connection = db();
  let begun = false;
  try {
    connection.exec("BEGIN IMMEDIATE");
    begun = true;
    const result = action();
    connection.exec("COMMIT");
    return result;
  } catch (error: unknown) {
    if (begun) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Preserve the original failure.
      }
    }
    throw translateSqliteError(error);
  }
}

function applyAuthorizer(connection: DatabaseSync): void {
  const deniedActions = new Set<number>([
    constants.SQLITE_ATTACH,
    constants.SQLITE_DETACH,
    constants.SQLITE_ALTER_TABLE,
    constants.SQLITE_CREATE_INDEX,
    constants.SQLITE_CREATE_TABLE,
    constants.SQLITE_CREATE_TEMP_INDEX,
    constants.SQLITE_CREATE_TEMP_TABLE,
    constants.SQLITE_CREATE_TEMP_TRIGGER,
    constants.SQLITE_CREATE_TEMP_VIEW,
    constants.SQLITE_CREATE_TRIGGER,
    constants.SQLITE_CREATE_VIEW,
    constants.SQLITE_DROP_INDEX,
    constants.SQLITE_DROP_TABLE,
    constants.SQLITE_DROP_TEMP_INDEX,
    constants.SQLITE_DROP_TEMP_TABLE,
    constants.SQLITE_DROP_TEMP_TRIGGER,
    constants.SQLITE_DROP_TEMP_VIEW,
    constants.SQLITE_DROP_TRIGGER,
    constants.SQLITE_DROP_VIEW,
  ]);
  connection.setAuthorizer((actionCode: number, _arg1: string | null, arg2: string | null) => {
    if (deniedActions.has(actionCode)) return constants.SQLITE_DENY;
    if (actionCode === constants.SQLITE_FUNCTION && arg2?.toLowerCase() === "load_extension") {
      return constants.SQLITE_DENY;
    }
    return constants.SQLITE_OK;
  });
}

async function loadMigrationAssets(): Promise<{
  readonly manifest: MigrationManifest;
  readonly sql: string;
  readonly migration: MigrationManifest["migrations"][number];
}> {
  const manifestUrl = new URL("../migrations/manifest.json", import.meta.url);
  const sqlUrl = new URL("../migrations/001-initial.sql", import.meta.url);
  const [manifestText, sql] = await Promise.all([
    readFile(manifestUrl, "utf8"),
    readFile(sqlUrl, "utf8"),
  ]);
  const parsed = JSON.parse(manifestText) as MigrationManifest;
  const migration = parsed.migrations[0];
  if (
    parsed.schemaVersion !== "1.0.0" ||
    parsed.databaseSchemaVersion !== 1 ||
    parsed.migrations.length !== 1 ||
    migration === undefined ||
    migration.version !== 1 ||
    migration.path !== "migrations/001-initial.sql" ||
    sha256(sql) !== migration.sha256
  ) {
    throw new InternalPersistenceError(
      "PERSISTENCE_MIGRATION_MISMATCH",
      "Migration manifest or checksum mismatch",
    );
  }
  return { manifest: parsed, sql, migration };
}

function applyMigration(
  connection: DatabaseSync,
  sql: string,
  migration: MigrationManifest["migrations"][number],
): void {
  let begun = false;
  try {
    connection.exec("BEGIN IMMEDIATE");
    begun = true;
    connection.exec(sql);
    const existing = connection
      .prepare("SELECT name, sha256 FROM migration_history WHERE version = ?")
      .get(migration.version);
    if (existing === undefined) {
      connection
        .prepare(
          "INSERT INTO migration_history(version, name, sha256, applied_at) VALUES (?, ?, ?, ?)",
        )
        .run(migration.version, migration.name, migration.sha256, "2026-08-31T00:00:00.000Z");
    } else {
      const row = asRecord(existing, "migration_history");
      if (row["name"] !== migration.name || row["sha256"] !== migration.sha256) {
        throw new InternalPersistenceError(
          "PERSISTENCE_MIGRATION_MISMATCH",
          "Applied migration identity or checksum differs from authority",
          { version: migration.version },
        );
      }
    }
    connection.exec("COMMIT");
  } catch (error: unknown) {
    if (begun) {
      try {
        connection.exec("ROLLBACK");
      } catch {
        // Preserve the migration failure.
      }
    }
    throw translateSqliteError(error);
  }
}

async function initialize(): Promise<void> {
  if (
    !Number.isSafeInteger(configuration.busyTimeoutMs) ||
    configuration.busyTimeoutMs < 1 ||
    configuration.busyTimeoutMs > 60_000
  ) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CONTRACT_INVALID",
      "busyTimeoutMs is outside the trusted bound",
    );
  }
  await mkdir(dirname(databasePath), { recursive: true });
  const assets = await loadMigrationAssets();
  const connection = new DatabaseSync(databasePath, {
    allowExtension: false,
    defensive: true,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
    timeout: configuration.busyTimeoutMs,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
    limits: {
      length: 16 * 1024 * 1024,
      sqlLength: 256 * 1024,
      column: 128,
      exprDepth: 64,
      compoundSelect: 16,
      vdbeOp: 250_000,
      functionArg: 32,
      attach: 0,
      likePatternLength: 4_096,
      variableNumber: 2_048,
      triggerDepth: 16,
    },
  });
  database = connection;
  connection.exec("PRAGMA journal_mode = WAL");
  connection.exec("PRAGMA synchronous = FULL");
  connection.exec("PRAGMA foreign_keys = ON");
  connection.exec("PRAGMA trusted_schema = OFF");
  connection.exec(`PRAGMA busy_timeout = ${String(configuration.busyTimeoutMs)}`);
  quickCheck(connection, "quick_check");
  applyMigration(connection, assets.sql, assets.migration);
  quickCheck(connection, "quick_check");
  applyAuthorizer(connection);
  manifest = assets.manifest;
}

function verifyEvent(
  event: DomainEventEnvelope,
  batch: JournalAppendBatch,
  expectedVersion: number,
): void {
  if (
    event.aggregateType !== batch.stream.aggregateType ||
    event.aggregateId !== batch.stream.aggregateId ||
    event.aggregateVersion !== expectedVersion
  ) {
    throw new InternalPersistenceError(
      "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
      "Event aggregate identity or version differs from the append stream",
      {
        eventId: event.eventId,
        expectedVersion,
        actualVersion: event.aggregateVersion,
      },
    );
  }
  const actualPayloadHash = canonicalJsonSha256(event.payload);
  if (actualPayloadHash !== event.payloadHash) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CONTRACT_INVALID",
      "Event payload hash does not match canonical payload",
      { eventId: event.eventId },
    );
  }
}

function verifyOutbox(batch: JournalAppendBatch): void {
  for (const task of batch.outbox) {
    if (canonicalJsonSha256(task.payload) !== task.payloadHash) {
      throw new InternalPersistenceError(
        "PERSISTENCE_CONTRACT_INVALID",
        "Outbox payload hash does not match canonical payload",
        { taskId: task.taskId },
      );
    }
  }
}

function currentAggregateVersion(batch: JournalAppendBatch): number {
  const row = asRecord(
    db()
      .prepare(
        "SELECT COALESCE(MAX(aggregate_version), 0) AS version FROM event_journal WHERE aggregate_type = ? AND aggregate_id = ?",
      )
      .get(batch.stream.aggregateType, batch.stream.aggregateId),
    "aggregate version",
  );
  return requiredSafeInteger(row, "version", "aggregate version");
}

function findDuplicate(batch: JournalAppendBatch): JsonRecord | undefined {
  const existing = db()
    .prepare(
      "SELECT command_id, payload_hash, receipt_json FROM command_receipts WHERE idempotency_key = ? AND effect_scope = ?",
    )
    .get(batch.idempotencyKey, batch.effectScope);
  return existing === undefined ? undefined : asRecord(existing, "command receipt");
}

function commitBatch(batch: JournalAppendBatch): PersistenceCommitReceipt {
  const duplicate = findDuplicate(batch);
  if (duplicate !== undefined) {
    if (
      duplicate["command_id"] !== batch.commandId ||
      duplicate["payload_hash"] !== batch.payloadHash
    ) {
      throw new InternalPersistenceError(
        "PERSISTENCE_IDEMPOTENCY_CONFLICT",
        "Idempotency identity was reused with a different command or payload",
      );
    }
    return parseJson<PersistenceCommitReceipt>(duplicate["receipt_json"], "command receipt");
  }
  verifyOutbox(batch);
  return runTransaction(() => {
    const transactionalDuplicate = findDuplicate(batch);
    if (transactionalDuplicate !== undefined) {
      if (
        transactionalDuplicate["command_id"] !== batch.commandId ||
        transactionalDuplicate["payload_hash"] !== batch.payloadHash
      ) {
        throw new InternalPersistenceError(
          "PERSISTENCE_IDEMPOTENCY_CONFLICT",
          "Idempotency identity was reused inside the transaction",
        );
      }
      return parseJson<PersistenceCommitReceipt>(
        transactionalDuplicate["receipt_json"],
        "command receipt",
      );
    }
    const currentVersion = currentAggregateVersion(batch);
    if (currentVersion !== batch.stream.expectedVersion) {
      throw new InternalPersistenceError(
        "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
        "Aggregate expected version does not match authority storage",
        { expectedVersion: batch.stream.expectedVersion, actualVersion: currentVersion },
      );
    }
    const insertEvent = db().prepare(
      "INSERT INTO event_journal(event_id, aggregate_type, aggregate_id, aggregate_version, occurred_at, payload_schema_id, payload_schema_version, payload_schema_hash, payload_hash, payload_json, event_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    batch.events.forEach((event, index) => {
      verifyEvent(event, batch, currentVersion + index + 1);
      insertEvent.run(
        event.eventId,
        event.aggregateType,
        event.aggregateId,
        event.aggregateVersion,
        event.occurredAt,
        event.payloadSchema.schemaId,
        event.payloadSchema.schemaVersion,
        event.payloadSchema.schemaHash,
        event.payloadHash,
        canonicalJson(event.payload),
        canonicalJson(event),
      );
    });
    const insertOutbox = db().prepare(
      "INSERT INTO outbox(task_id, idempotency_key, effect_scope, payload_hash, envelope_json, status, attempt, created_at, leased_until) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, NULL)",
    );
    for (const task of batch.outbox) {
      insertOutbox.run(
        task.taskId,
        task.idempotencyKey,
        task.effectScope,
        task.payloadHash,
        canonicalJson(task),
        task.attempt,
        batch.capturedAt,
      );
    }
    const insertAudit = db().prepare(
      "INSERT INTO audit_facts(audit_id, occurred_at, action, payload_hash) VALUES (?, ?, ?, ?)",
    );
    for (const audit of batch.audit) {
      insertAudit.run(audit.auditId, audit.occurredAt, audit.action, audit.payloadHash);
    }
    const receiptBase = {
      schemaVersion: "1.0.0" as const,
      transactionId: batch.transactionId,
      commandId: batch.commandId,
      aggregateType: batch.stream.aggregateType,
      aggregateId: batch.stream.aggregateId,
      committedVersion: currentVersion + batch.events.length,
      eventIds: batch.events.map((event) => event.eventId),
      outboxTaskIds: batch.outbox.map((task) => task.taskId),
      auditIds: batch.audit.map((audit) => audit.auditId),
      committedAt: batch.capturedAt,
    };
    const receipt: PersistenceCommitReceipt = {
      ...receiptBase,
      receiptHash: canonicalJsonSha256(receiptBase),
    };
    db()
      .prepare(
        "INSERT INTO command_receipts(command_id, idempotency_key, effect_scope, payload_hash, outcome_hash, status, receipt_json, completed_at) VALUES (?, ?, ?, ?, ?, 'COMMITTED', ?, ?)",
      )
      .run(
        batch.commandId,
        batch.idempotencyKey,
        batch.effectScope,
        batch.payloadHash,
        receipt.receiptHash,
        canonicalJson(receipt),
        batch.capturedAt,
      );
    return receipt;
  });
}

function recordInbox(record: InboxRecord): InboxRecord {
  return runTransaction(() => {
    const existing = db()
      .prepare(
        "SELECT result_id, task_id, payload_hash, status, received_at FROM inbox WHERE result_id = ? OR task_id = ?",
      )
      .get(record.resultId, record.taskId);
    if (existing !== undefined) {
      const row = asRecord(existing, "inbox");
      if (row["payload_hash"] !== record.payloadHash) {
        throw new InternalPersistenceError(
          "PERSISTENCE_IDEMPOTENCY_CONFLICT",
          "Inbox identity was reused with a different payload",
        );
      }
      return {
        schemaVersion: "1.0.0",
        resultId: requiredString(row, "result_id", "inbox"),
        taskId: requiredString(row, "task_id", "inbox"),
        payloadHash: requiredString(row, "payload_hash", "inbox"),
        status: "DUPLICATE",
        receivedAt: requiredString(row, "received_at", "inbox"),
      };
    }
    db()
      .prepare(
        "INSERT INTO inbox(result_id, task_id, payload_hash, status, received_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(record.resultId, record.taskId, record.payloadHash, record.status, record.receivedAt);
    return record;
  });
}

function saveCheckpoint(checkpoint: ProjectionCheckpoint): ProjectionCheckpoint {
  return runTransaction(() => {
    const existing = db()
      .prepare(
        "SELECT source_sequence FROM projection_checkpoints WHERE projection_name = ?",
      )
      .get(checkpoint.projectionName);
    if (
      existing !== undefined &&
      requiredSafeInteger(asRecord(existing, "projection checkpoint"), "source_sequence", "checkpoint") >
        checkpoint.sourceSequence
    ) {
      throw new InternalPersistenceError(
        "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
        "Projection checkpoint cannot move backwards",
      );
    }
    db()
      .prepare(
        "INSERT INTO projection_checkpoints(projection_name, projection_version, source_sequence, rebuilt_from_sequence, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(projection_name) DO UPDATE SET projection_version = excluded.projection_version, source_sequence = excluded.source_sequence, rebuilt_from_sequence = excluded.rebuilt_from_sequence, updated_at = excluded.updated_at",
      )
      .run(
        checkpoint.projectionName,
        checkpoint.projectionVersion,
        checkpoint.sourceSequence,
        checkpoint.rebuiltFromSequence,
        checkpoint.updatedAt,
      );
    return checkpoint;
  });
}

function getCommand(commandId: string): CommandDedupRecord | null {
  const value = db()
    .prepare(
      "SELECT command_id, idempotency_key, effect_scope, payload_hash, outcome_hash, status, completed_at FROM command_receipts WHERE command_id = ?",
    )
    .get(commandId);
  if (value === undefined) return null;
  const row = asRecord(value, "command receipt");
  return {
    schemaVersion: "1.0.0",
    commandId: requiredString(row, "command_id", "command receipt"),
    idempotencyKey: requiredString(row, "idempotency_key", "command receipt"),
    effectScope: requiredString(row, "effect_scope", "command receipt"),
    payloadHash: requiredString(row, "payload_hash", "command receipt"),
    outcomeHash: requiredString(row, "outcome_hash", "command receipt"),
    status: "COMMITTED",
    completedAt: requiredString(row, "completed_at", "command receipt"),
  };
}

function listOutbox(): readonly OutboxRecord[] {
  const rows = db()
    .prepare(
      "SELECT task_id, idempotency_key, effect_scope, payload_hash, status, attempt, created_at, leased_until FROM outbox ORDER BY task_id",
    )
    .all() as unknown[];
  return rows.map((value) => {
    const row = asRecord(value, "outbox");
    const leasedUntil = row["leased_until"];
    return {
      schemaVersion: "1.0.0",
      taskId: requiredString(row, "task_id", "outbox"),
      idempotencyKey: requiredString(row, "idempotency_key", "outbox"),
      effectScope: requiredString(row, "effect_scope", "outbox"),
      payloadHash: requiredString(row, "payload_hash", "outbox"),
      status: "PENDING",
      attempt: requiredSafeInteger(row, "attempt", "outbox"),
      createdAt: requiredString(row, "created_at", "outbox"),
      leasedUntil: typeof leasedUntil === "string" ? leasedUntil : null,
    };
  });
}

function readEvents(payload: JsonRecord): readonly DomainEventEnvelope[] {
  const aggregateType = requiredString(payload, "aggregateType", "read-events");
  const aggregateId = requiredString(payload, "aggregateId", "read-events");
  const limit = requiredSafeInteger(payload, "limit", "read-events");
  const rows = db()
    .prepare(
      "SELECT event_json FROM event_journal WHERE aggregate_type = ? AND aggregate_id = ? ORDER BY aggregate_version LIMIT ?",
    )
    .all(aggregateType, aggregateId, limit) as unknown[];
  return rows.map((value) =>
    parseJson<DomainEventEnvelope>(asRecord(value, "event journal")["event_json"], "event journal"),
  );
}

function health(): Readonly<Record<string, unknown>> {
  const connection = db();
  const journal = asRecord(connection.prepare("PRAGMA journal_mode").get(), "journal_mode");
  const synchronous = asRecord(connection.prepare("PRAGMA synchronous").get(), "synchronous");
  const foreignKeys = asRecord(connection.prepare("PRAGMA foreign_keys").get(), "foreign_keys");
  const trustedSchema = asRecord(
    connection.prepare("PRAGMA trusted_schema").get(),
    "trusted_schema",
  );
  const busyTimeout = asRecord(connection.prepare("PRAGMA busy_timeout").get(), "busy_timeout");
  const version = asRecord(
    connection.prepare("SELECT sqlite_version() AS version").get(),
    "sqlite_version",
  );
  if (
    String(journal["journal_mode"]).toLowerCase() !== "wal" ||
    synchronous["synchronous"] !== 2 ||
    foreignKeys["foreign_keys"] !== 1 ||
    trustedSchema["trusted_schema"] !== 0 ||
    busyTimeout["timeout"] !== configuration.busyTimeoutMs
  ) {
    throw new InternalPersistenceError(
      "PERSISTENCE_SECURITY_CONTROL_FAILED",
      "SQLite durability or security PRAGMA attestation failed",
      { journal, synchronous, foreignKeys, trustedSchema, busyTimeout },
    );
  }
  quickCheck(connection, "quick_check");
  return {
    databasePath,
    sqliteVersion: requiredString(version, "version", "sqlite_version"),
    journalMode: "wal",
    synchronous: 2,
    foreignKeys: 1,
    trustedSchema: 0,
    busyTimeoutMs: configuration.busyTimeoutMs,
    defensive: true,
    extensionLoading: false,
    doubleQuotedStringLiterals: false,
    integrity: "ok",
  };
}

function count(table: string, where = ""): number {
  const allowed = new Set([
    "event_journal",
    "command_receipts",
    "outbox",
    "inbox",
    "audit_facts",
    "projection_checkpoints",
  ]);
  if (!allowed.has(table)) {
    throw new InternalPersistenceError(
      "PERSISTENCE_STORAGE_FAILURE",
      "Recovery count requested an unknown table",
    );
  }
  const row = asRecord(
    db().prepare(`SELECT COUNT(*) AS count FROM ${table} ${where}`).get(),
    `${table} count`,
  );
  return requiredSafeInteger(row, "count", `${table} count`);
}

function recover(): Readonly<Record<string, unknown>> {
  const integrity = quickCheck(db(), "quick_check");
  return {
    eventCount: count("event_journal"),
    commandCount: count("command_receipts"),
    pendingOutboxCount: count("outbox", "WHERE status = 'PENDING'"),
    inboxCount: count("inbox"),
    auditCount: count("audit_facts"),
    checkpointCount: count("projection_checkpoints"),
    integrity,
  };
}

function stateSchemaManifest(): StateSchemaManifest {
  if (manifest === undefined) {
    throw new InternalPersistenceError(
      "PERSISTENCE_MIGRATION_MISMATCH",
      "State schema manifest is unavailable",
    );
  }
  const version = asRecord(
    db().prepare("SELECT sqlite_version() AS version").get(),
    "sqlite_version",
  );
  return {
    schemaVersion: "1.0.0",
    databaseSchemaVersion: manifest.databaseSchemaVersion,
    migrations: manifest.migrations.map((migration) => ({
      version: migration.version,
      name: migration.name,
      sha256: migration.sha256,
    })),
    sqliteVersion: requiredString(version, "version", "sqlite_version"),
    compatibility: "COMPATIBLE",
  };
}

async function backupDatabase(payload: JsonRecord): Promise<Readonly<Record<string, unknown>>> {
  const destination = requiredString(payload, "destination", "backup");
  if (resolve(destination) === databasePath) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CONTRACT_INVALID",
      "Backup destination must differ from authority database",
    );
  }
  await mkdir(dirname(destination), { recursive: true });
  const pages = await backup(db(), destination, { rate: 64 });
  const verification = new DatabaseSync(destination, {
    readOnly: true,
    allowExtension: false,
    defensive: true,
    enableDoubleQuotedStringLiterals: false,
    enableForeignKeyConstraints: true,
  });
  try {
    quickCheck(verification, "integrity_check");
  } finally {
    verification.close();
  }
  const bytes = await readFile(destination);
  return {
    destination,
    sha256: sha256(bytes),
    sizeBytes: bytes.byteLength,
    pages,
    integrity: "ok",
  };
}

function securityQualification(): Readonly<Record<string, unknown>> {
  const connection = db();
  let attachDenied = false;
  let schemaMutationDenied = false;
  let extensionLoadingDenied = false;
  try {
    connection.exec("ATTACH DATABASE ':memory:' AS forbidden");
  } catch {
    attachDenied = true;
  }
  try {
    connection.exec("CREATE TABLE forbidden_runtime_ddl(id INTEGER)");
  } catch {
    schemaMutationDenied = true;
  }
  try {
    connection.prepare("SELECT load_extension(?)").get("forbidden");
  } catch {
    extensionLoadingDenied = true;
  }
  const injection = "'; DROP TABLE event_journal; --";
  const bound = asRecord(connection.prepare("SELECT ? AS value").get(injection), "binding probe");
  const journalPresent = count("event_journal") >= 0;
  if (!attachDenied || !schemaMutationDenied || !extensionLoadingDenied || bound["value"] !== injection) {
    throw new InternalPersistenceError(
      "PERSISTENCE_SECURITY_CONTROL_FAILED",
      "SQLite runtime security qualification did not fail closed",
    );
  }
  return {
    attachDenied: true,
    schemaMutationDenied: true,
    extensionLoadingDenied: true,
    parameterBindingPreservedJournal: journalPresent,
  };
}

function armCrash(batch: JournalAppendBatch): "ARMED" {
  if (writeLockHeld || crashTransactionArmed) {
    throw new InternalPersistenceError(
      "PERSISTENCE_BUSY",
      "A qualification transaction is already active",
    );
  }
  verifyOutbox(batch);
  const currentVersion = currentAggregateVersion(batch);
  if (currentVersion !== batch.stream.expectedVersion) {
    throw new InternalPersistenceError(
      "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
      "Crash probe expected version mismatch",
    );
  }
  const event = batch.events[0];
  if (event === undefined) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CONTRACT_INVALID",
      "Crash probe requires an event",
    );
  }
  verifyEvent(event, batch, currentVersion + 1);
  try {
    db().exec("BEGIN IMMEDIATE");
    db()
      .prepare(
        "INSERT INTO event_journal(event_id, aggregate_type, aggregate_id, aggregate_version, occurred_at, payload_schema_id, payload_schema_version, payload_schema_hash, payload_hash, payload_json, event_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        event.eventId,
        event.aggregateType,
        event.aggregateId,
        event.aggregateVersion,
        event.occurredAt,
        event.payloadSchema.schemaId,
        event.payloadSchema.schemaVersion,
        event.payloadSchema.schemaHash,
        event.payloadHash,
        canonicalJson(event.payload),
        canonicalJson(event),
      );
    crashTransactionArmed = true;
    return "ARMED";
  } catch (error: unknown) {
    try {
      db().exec("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw translateSqliteError(error);
  }
}

function holdLock(): "LOCKED" {
  if (writeLockHeld || crashTransactionArmed) {
    throw new InternalPersistenceError(
      "PERSISTENCE_BUSY",
      "A qualification transaction is already active",
    );
  }
  try {
    db().exec("BEGIN IMMEDIATE");
    writeLockHeld = true;
    return "LOCKED";
  } catch (error: unknown) {
    throw translateSqliteError(error);
  }
}

function releaseLock(): "RELEASED" {
  if (!writeLockHeld) {
    throw new InternalPersistenceError(
      "PERSISTENCE_CONTRACT_INVALID",
      "No qualification write lock is active",
    );
  }
  db().exec("ROLLBACK");
  writeLockHeld = false;
  return "RELEASED";
}

function closeDatabase(): "CLOSED" {
  if (writeLockHeld || crashTransactionArmed) {
    try {
      db().exec("ROLLBACK");
    } catch {
      // Closing remains fail-safe after an interrupted qualification transaction.
    }
  }
  db().exec("PRAGMA wal_checkpoint(TRUNCATE)");
  db().close();
  database = undefined;
  return "CLOSED";
}

async function handle(request: WorkerRequest): Promise<unknown> {
  const payload = asRecord(request.payload, request.kind);
  switch (request.kind) {
    case "arm-crash":
      return armCrash(request.payload as JournalAppendBatch);
    case "backup":
      return backupDatabase(payload);
    case "close":
      return closeDatabase();
    case "commit":
      return commitBatch(request.payload as JournalAppendBatch);
    case "get-command":
      return getCommand(requiredString(payload, "commandId", "get-command"));
    case "health":
      return health();
    case "hold-lock":
      return holdLock();
    case "list-outbox":
      return listOutbox();
    case "read-events":
      return readEvents(payload);
    case "record-inbox":
      return recordInbox(request.payload as InboxRecord);
    case "recover":
      return recover();
    case "release-lock":
      return releaseLock();
    case "save-checkpoint":
      return saveCheckpoint(request.payload as ProjectionCheckpoint);
    case "security":
      return securityQualification();
    case "state-manifest":
      return stateSchemaManifest();
    default:
      throw new InternalPersistenceError(
        "PERSISTENCE_CONTRACT_INVALID",
        `Unknown persistence worker request: ${request.kind}`,
      );
  }
}

const databaseExisted = await fileExistsWithBytes(databasePath);
try {
  await initialize();
  port.postMessage({ kind: "ready", ok: true });
  let serial = Promise.resolve();
  port.on("message", (value: unknown): void => {
    const request = value as WorkerRequest;
    serial = serial.then(async (): Promise<void> => {
      try {
        const result = await handle(request);
        port.postMessage({ kind: "reply", id: request.id, ok: true, value: result });
        if (request.kind === "close") port.close();
      } catch (error: unknown) {
        port.postMessage({
          kind: "reply",
          id: request.id,
          ok: false,
          error: serializeError(error),
        });
      }
    });
  });
} catch (error: unknown) {
  try {
    database?.close();
  } catch {
    // Initialization already failed; preserve the original finding.
  }
  database = undefined;
  const serialized = serializeError(error);
  const quarantinePath = databaseExisted ? await quarantineDatabase() : undefined;
  const details =
    quarantinePath === undefined
      ? serialized.details
      : { ...serialized.details, quarantinePath, databasePath };
  port.postMessage({
    kind: "ready",
    ok: false,
    error:
      quarantinePath === undefined
        ? serialized
        : {
            code: "PERSISTENCE_CORRUPTION",
            message: serialized.message,
            details,
          },
  });
  port.close();
}
