CREATE TABLE IF NOT EXISTS migration_history (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS event_journal (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  aggregate_version INTEGER NOT NULL CHECK (aggregate_version >= 1),
  occurred_at TEXT NOT NULL,
  payload_schema_id TEXT NOT NULL,
  payload_schema_version TEXT NOT NULL,
  payload_schema_hash TEXT NOT NULL CHECK (length(payload_schema_hash) = 64),
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  payload_json TEXT NOT NULL,
  event_json TEXT NOT NULL,
  UNIQUE (aggregate_type, aggregate_id, aggregate_version)
) STRICT;

CREATE TABLE IF NOT EXISTS command_receipts (
  command_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  effect_scope TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  outcome_hash TEXT NOT NULL CHECK (length(outcome_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('COMMITTED', 'REJECTED')),
  receipt_json TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  UNIQUE (idempotency_key, effect_scope)
) STRICT;

CREATE TABLE IF NOT EXISTS outbox (
  task_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL,
  effect_scope TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  envelope_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'DISPATCHED', 'FAILED')),
  attempt INTEGER NOT NULL CHECK (attempt >= 0),
  created_at TEXT NOT NULL,
  leased_until TEXT,
  UNIQUE (idempotency_key, effect_scope)
) STRICT;

CREATE TABLE IF NOT EXISTS inbox (
  result_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED', 'DUPLICATE', 'REJECTED')),
  received_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS audit_facts (
  audit_id TEXT PRIMARY KEY,
  occurred_at TEXT NOT NULL,
  action TEXT NOT NULL,
  payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64)
) STRICT;

CREATE TABLE IF NOT EXISTS projection_checkpoints (
  projection_name TEXT PRIMARY KEY,
  projection_version TEXT NOT NULL,
  source_sequence INTEGER NOT NULL CHECK (source_sequence >= 0),
  rebuilt_from_sequence INTEGER CHECK (rebuilt_from_sequence >= 0),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER IF NOT EXISTS event_journal_no_update
BEFORE UPDATE ON event_journal
BEGIN
  SELECT RAISE(ABORT, 'EVENT_JOURNAL_APPEND_ONLY');
END;

CREATE TRIGGER IF NOT EXISTS event_journal_no_delete
BEFORE DELETE ON event_journal
BEGIN
  SELECT RAISE(ABORT, 'EVENT_JOURNAL_APPEND_ONLY');
END;
