import { isAbsolute, resolve } from "node:path";
import { Worker } from "node:worker_threads";

import {
  loadContractRegistry,
  type CommandDedupRecord,
  type ContractRegistry,
  type DomainEventEnvelope,
  type InboxRecord,
  type JournalAppendBatch,
  type OutboxRecord,
  type PersistenceCommitReceipt,
  type ProjectionCheckpoint,
  type StateSchemaManifest,
} from "@aseos/contracts";

export type PersistenceErrorCode =
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

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly details: Readonly<Record<string, unknown>> | undefined;

  public constructor(
    code: PersistenceErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    this.details = details;
  }
}

export type PersistenceWorkerOptions = Readonly<{
  dataRoot: string;
  maxQueueDepth?: number;
  busyTimeoutMs?: number;
  repositoryRoot?: string;
}>;

export type PersistenceHealth = Readonly<{
  databasePath: string;
  sqliteVersion: string;
  journalMode: "wal";
  synchronous: 2;
  foreignKeys: 1;
  trustedSchema: 0;
  busyTimeoutMs: number;
  defensive: true;
  extensionLoading: false;
  doubleQuotedStringLiterals: false;
  integrity: "ok";
}>;

export type PersistenceRecovery = Readonly<{
  eventCount: number;
  commandCount: number;
  pendingOutboxCount: number;
  inboxCount: number;
  auditCount: number;
  checkpointCount: number;
  integrity: "ok";
}>;

export type PersistenceBackup = Readonly<{
  destination: string;
  sha256: string;
  sizeBytes: number;
  pages: number;
  integrity: "ok";
}>;

export type PersistenceSecurityQualification = Readonly<{
  attachDenied: true;
  schemaMutationDenied: true;
  extensionLoadingDenied: true;
  parameterBindingPreservedJournal: true;
}>;

type WorkerRequestKind =
  | "arm-crash"
  | "backup"
  | "close"
  | "commit"
  | "get-command"
  | "health"
  | "hold-lock"
  | "list-outbox"
  | "read-events"
  | "record-inbox"
  | "recover"
  | "release-lock"
  | "save-checkpoint"
  | "security"
  | "state-manifest";

type SerializedError = Readonly<{
  code: PersistenceErrorCode;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}>;

type WorkerMessage =
  | Readonly<{ kind: "ready"; ok: true }>
  | Readonly<{ kind: "ready"; ok: false; error: SerializedError }>
  | Readonly<{ kind: "reply"; id: number; ok: true; value: unknown }>
  | Readonly<{ kind: "reply"; id: number; ok: false; error: SerializedError }>;

type PendingRequest = Readonly<{
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}>;

function positiveInteger(value: number | undefined, fallback: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1) {
    throw new PersistenceError("PERSISTENCE_CONTRACT_INVALID", `${label} must be positive`);
  }
  return selected;
}

function asPersistenceError(error: SerializedError): PersistenceError {
  return new PersistenceError(error.code, error.message, error.details);
}

export class PersistenceWorker {
  readonly #worker: Worker;
  readonly #registry: ContractRegistry;
  readonly #maxQueueDepth: number;
  readonly #ready: Promise<void>;
  readonly #pending = new Map<number, PendingRequest>();
  #nextRequestId = 1;
  #closed = false;

  private constructor(worker: Worker, registry: ContractRegistry, maxQueueDepth: number) {
    this.#worker = worker;
    this.#registry = registry;
    this.#maxQueueDepth = maxQueueDepth;
    this.#ready = new Promise<void>((resolveReady, rejectReady) => {
      let readySettled = false;
      worker.on("message", (value: unknown): void => {
        const message = value as WorkerMessage;
        if (message.kind === "ready") {
          if (readySettled) return;
          readySettled = true;
          if (message.ok) {
            resolveReady();
          } else {
            rejectReady(asPersistenceError(message.error));
          }
          return;
        }
        const pending = this.#pending.get(message.id);
        if (pending === undefined) return;
        this.#pending.delete(message.id);
        if (message.ok) {
          pending.resolve(message.value);
        } else {
          pending.reject(asPersistenceError(message.error));
        }
      });
      worker.once("error", (error: Error): void => {
        const failure = new PersistenceError(
          "PERSISTENCE_WORKER_EXITED",
          `Persistence worker error: ${error.message}`,
        );
        if (!readySettled) {
          readySettled = true;
          rejectReady(failure);
        }
        this.#failPending(failure);
      });
      worker.once("exit", (code: number): void => {
        if (this.#closed && code === 0) return;
        const failure = new PersistenceError(
          "PERSISTENCE_WORKER_EXITED",
          `Persistence worker exited with code ${String(code)}`,
          { exitCode: code },
        );
        if (!readySettled) {
          readySettled = true;
          rejectReady(failure);
        }
        this.#failPending(failure);
      });
    });
  }

  public static async open(options: PersistenceWorkerOptions): Promise<PersistenceWorker> {
    if (options.dataRoot.length === 0) {
      throw new PersistenceError("PERSISTENCE_CONTRACT_INVALID", "dataRoot must not be empty");
    }
    const maxQueueDepth = positiveInteger(options.maxQueueDepth, 128, "maxQueueDepth");
    const busyTimeoutMs = positiveInteger(options.busyTimeoutMs, 5_000, "busyTimeoutMs");
    const dataRoot = isAbsolute(options.dataRoot) ? options.dataRoot : resolve(options.dataRoot);
    const registry =
      options.repositoryRoot === undefined
        ? await loadContractRegistry()
        : await loadContractRegistry(options.repositoryRoot);
    const worker = new Worker(new URL("./persistence-worker.js", import.meta.url), {
      name: "aseos-persistence",
      workerData: { dataRoot, busyTimeoutMs },
    });
    const instance = new PersistenceWorker(worker, registry, maxQueueDepth);
    await instance.#ready;
    return instance;
  }

  public async commit(batch: JournalAppendBatch): Promise<PersistenceCommitReceipt> {
    const validated = this.#validate<JournalAppendBatch>(
      "urn:aseos:schema:journal-append-batch:1.0.0",
      batch,
    );
    const receipt = await this.#request<PersistenceCommitReceipt>("commit", validated);
    return this.#validate<PersistenceCommitReceipt>(
      "urn:aseos:schema:persistence-commit-receipt:1.0.0",
      receipt,
    );
  }

  public async recordInbox(record: InboxRecord): Promise<InboxRecord> {
    const validated = this.#validate<InboxRecord>("urn:aseos:schema:inbox-record:1.0.0", record);
    const persisted = await this.#request<InboxRecord>("record-inbox", validated);
    return this.#validate<InboxRecord>("urn:aseos:schema:inbox-record:1.0.0", persisted);
  }

  public async saveProjectionCheckpoint(
    checkpoint: ProjectionCheckpoint,
  ): Promise<ProjectionCheckpoint> {
    const validated = this.#validate<ProjectionCheckpoint>(
      "urn:aseos:schema:projection-checkpoint:1.0.0",
      checkpoint,
    );
    const persisted = await this.#request<ProjectionCheckpoint>("save-checkpoint", validated);
    return this.#validate<ProjectionCheckpoint>(
      "urn:aseos:schema:projection-checkpoint:1.0.0",
      persisted,
    );
  }

  public async getCommandDedup(commandId: string): Promise<CommandDedupRecord | null> {
    const record = await this.#request<CommandDedupRecord | null>("get-command", { commandId });
    return record === null
      ? null
      : this.#validate<CommandDedupRecord>("urn:aseos:schema:command-dedup-record:1.0.0", record);
  }

  public async listOutbox(): Promise<readonly OutboxRecord[]> {
    const records = await this.#request<readonly OutboxRecord[]>("list-outbox", {});
    return records.map((record) =>
      this.#validate<OutboxRecord>("urn:aseos:schema:outbox-record:1.0.0", record),
    );
  }

  public async readEvents(
    aggregateType: string,
    aggregateId: string,
    limit = 10_000,
  ): Promise<readonly DomainEventEnvelope[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000) {
      throw new PersistenceError(
        "PERSISTENCE_CONTRACT_INVALID",
        "readEvents limit must be between 1 and 100000",
      );
    }
    return this.#request<readonly DomainEventEnvelope[]>("read-events", {
      aggregateType,
      aggregateId,
      limit,
    });
  }

  public async health(): Promise<PersistenceHealth> {
    return this.#request<PersistenceHealth>("health", {});
  }

  public async recover(): Promise<PersistenceRecovery> {
    return this.#request<PersistenceRecovery>("recover", {});
  }

  public async stateSchemaManifest(): Promise<StateSchemaManifest> {
    const manifest = await this.#request<StateSchemaManifest>("state-manifest", {});
    return this.#validate<StateSchemaManifest>(
      "urn:aseos:schema:state-schema-manifest:1.0.0",
      manifest,
    );
  }

  public async backup(destination: string): Promise<PersistenceBackup> {
    if (destination.length === 0) {
      throw new PersistenceError(
        "PERSISTENCE_CONTRACT_INVALID",
        "backup destination must not be empty",
      );
    }
    return this.#request<PersistenceBackup>("backup", { destination: resolve(destination) });
  }

  public async qualifySecurityControls(): Promise<PersistenceSecurityQualification> {
    return this.#request<PersistenceSecurityQualification>("security", {});
  }

  public async armCrashBeforeCommitForQualification(batch: JournalAppendBatch): Promise<void> {
    const validated = this.#validate<JournalAppendBatch>(
      "urn:aseos:schema:journal-append-batch:1.0.0",
      batch,
    );
    await this.#request<"ARMED">("arm-crash", validated);
  }

  public async holdWriteLockForQualification(): Promise<void> {
    await this.#request<"LOCKED">("hold-lock", {});
  }

  public async releaseWriteLockForQualification(): Promise<void> {
    await this.#request<"RELEASED">("release-lock", {});
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    await this.#request<"CLOSED">("close", {});
    this.#closed = true;
    await this.#worker.terminate();
  }

  public async terminateForQualification(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const failure = new PersistenceError(
      "PERSISTENCE_WORKER_EXITED",
      "Persistence worker terminated by qualification probe",
    );
    this.#failPending(failure);
    await this.#worker.terminate();
  }

  async #request<T>(kind: WorkerRequestKind, payload: unknown): Promise<T> {
    await this.#ready;
    if (this.#closed) {
      throw new PersistenceError("PERSISTENCE_CLOSED", "Persistence worker is closed");
    }
    if (this.#pending.size >= this.#maxQueueDepth) {
      throw new PersistenceError(
        "PERSISTENCE_QUEUE_FULL",
        "Persistence worker bounded queue is full",
        { maxQueueDepth: this.#maxQueueDepth },
      );
    }
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return new Promise<T>((resolveRequest, rejectRequest) => {
      this.#pending.set(id, {
        resolve: (value: unknown): void => {
          resolveRequest(value as T);
        },
        reject: rejectRequest,
      });
      this.#worker.postMessage({ id, kind, payload });
    });
  }

  #validate<T>(schemaId: string, value: T): T {
    const result = this.#registry.validate<T>({ schemaId, schemaVersion: "1.0.0" }, value);
    if (!result.ok) {
      throw new PersistenceError(
        "PERSISTENCE_CONTRACT_INVALID",
        `Persistence Contract rejected by ${schemaId}`,
        { code: result.code, errors: result.errors },
      );
    }
    return result.value;
  }

  #failPending(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
  }
}
