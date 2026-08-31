import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearInterval, setInterval } from "node:timers";

import { afterEach, describe, expect, test } from "vitest";

import { PersistenceWorker } from "@aseos/persistence";

import { makeJournalBatch, qualificationUuid } from "./helpers.mjs";

const roots = [];

async function dataRoot(label) {
  const root = await mkdtemp(join(tmpdir(), `aseos-p1-o05-${label}-`));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("P1-V06 node:sqlite authority storage qualification", () => {
  test("attests the fixed engine and fail-closed SQLite controls", async () => {
    const worker = await PersistenceWorker.open({ dataRoot: await dataRoot("health") });
    try {
      await expect(worker.health()).resolves.toMatchObject({
        sqliteVersion: "3.53.3",
        journalMode: "wal",
        synchronous: 2,
        foreignKeys: 1,
        trustedSchema: 0,
        busyTimeoutMs: 5_000,
        defensive: true,
        extensionLoading: false,
        doubleQuotedStringLiterals: false,
        integrity: "ok",
      });
      await expect(worker.qualifySecurityControls()).resolves.toEqual({
        attachDenied: true,
        schemaMutationDenied: true,
        extensionLoadingDenied: true,
        parameterBindingPreservedJournal: true,
      });
      await expect(worker.stateSchemaManifest()).resolves.toMatchObject({
        schemaVersion: "1.0.0",
        databaseSchemaVersion: 1,
        sqliteVersion: "3.53.3",
        compatibility: "COMPATIBLE",
      });
    } finally {
      await worker.close();
    }
  });

  test("commits Event receipt outbox and audit atomically with exact idempotency", async () => {
    const worker = await PersistenceWorker.open({ dataRoot: await dataRoot("atomic") });
    const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 2 });
    try {
      const receipt = await worker.commit(batch);
      expect(receipt).toMatchObject({
        commandId: batch.commandId,
        committedVersion: 2,
        eventIds: batch.events.map((event) => event.eventId),
      });
      await expect(worker.commit(batch)).resolves.toEqual(receipt);
      await expect(
        worker.commit({
          ...batch,
          commandId: qualificationUuid(90, 7),
          payloadHash: "0".repeat(64),
        }),
      ).rejects.toMatchObject({ code: "PERSISTENCE_IDEMPOTENCY_CONFLICT" });
      await expect(
        worker.commit(
          makeJournalBatch({
            sequence: 2,
            expectedVersion: 0,
            eventCount: 1,
          }),
        ),
      ).rejects.toMatchObject({ code: "PERSISTENCE_OPTIMISTIC_CONCURRENCY" });
      await expect(
        worker.readEvents(batch.stream.aggregateType, batch.stream.aggregateId),
      ).resolves.toEqual(batch.events);
      await expect(worker.getCommandDedup(batch.commandId)).resolves.toMatchObject({
        commandId: batch.commandId,
        payloadHash: batch.payloadHash,
        outcomeHash: receipt.receiptHash,
        status: "COMMITTED",
      });
      await expect(worker.listOutbox()).resolves.toHaveLength(1);
      await expect(worker.recover()).resolves.toMatchObject({
        eventCount: 2,
        commandCount: 1,
        pendingOutboxCount: 1,
        auditCount: 1,
        integrity: "ok",
      });
    } finally {
      await worker.close();
    }
  });

  test("deduplicates inbox and enforces monotonic projection checkpoints", async () => {
    const worker = await PersistenceWorker.open({ dataRoot: await dataRoot("inbox") });
    const inbox = {
      schemaVersion: "1.0.0",
      resultId: qualificationUuid(1, 9),
      taskId: qualificationUuid(1, 4),
      payloadHash: "1".repeat(64),
      status: "ACCEPTED",
      receivedAt: "2026-08-31T00:00:00.000Z",
    };
    try {
      await expect(worker.recordInbox(inbox)).resolves.toEqual(inbox);
      await expect(worker.recordInbox(inbox)).resolves.toMatchObject({ status: "DUPLICATE" });
      const checkpoint = {
        schemaVersion: "1.0.0",
        projectionName: "qualification",
        projectionVersion: "1.0.0",
        sourceSequence: 10,
        rebuiltFromSequence: 0,
        updatedAt: "2026-08-31T00:00:00.000Z",
      };
      await expect(worker.saveProjectionCheckpoint(checkpoint)).resolves.toEqual(checkpoint);
      await expect(
        worker.saveProjectionCheckpoint({ ...checkpoint, sourceSequence: 9 }),
      ).rejects.toMatchObject({ code: "PERSISTENCE_OPTIMISTIC_CONCURRENCY" });
    } finally {
      await worker.close();
    }
  });

  test("creates an integrity-checked online backup that restores independently", async () => {
    const sourceRoot = await dataRoot("backup-source");
    const restoreRoot = await dataRoot("backup-restore");
    const backupPath = join(sourceRoot, "backups", "authority.db");
    const source = await PersistenceWorker.open({ dataRoot: sourceRoot });
    await source.commit(makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 3 }));
    const backup = await source.backup(backupPath);
    expect(backup).toMatchObject({ destination: backupPath, integrity: "ok" });
    expect(backup.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(backup.sizeBytes).toBeGreaterThan(0);
    await source.close();

    await mkdir(join(restoreRoot, "state"), { recursive: true });
    await cp(backupPath, join(restoreRoot, "state", "aseos.db"));
    const restored = await PersistenceWorker.open({ dataRoot: restoreRoot });
    try {
      await expect(restored.recover()).resolves.toMatchObject({
        eventCount: 3,
        commandCount: 1,
        integrity: "ok",
      });
    } finally {
      await restored.close();
    }
  });

  test("keeps the Runtime event loop responsive while the dedicated worker writes", async () => {
    const worker = await PersistenceWorker.open({ dataRoot: await dataRoot("responsive") });
    const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 500 });
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
    }, 1);
    try {
      await worker.commit(batch);
      expect(ticks).toBeGreaterThan(0);
    } finally {
      clearInterval(timer);
      await worker.close();
    }
  });

  test("rejects unknown public fields through the canonical runtime Contract", async () => {
    const worker = await PersistenceWorker.open({ dataRoot: await dataRoot("boundary") });
    const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 1 });
    try {
      await expect(worker.commit({ ...batch, unexpected: true })).rejects.toMatchObject({
        code: "PERSISTENCE_CONTRACT_INVALID",
      });
    } finally {
      await worker.close();
    }
  });
});
