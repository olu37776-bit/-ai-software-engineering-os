import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { PersistenceWorker } from "@aseos/persistence";

import { makeJournalBatch } from "../../qualification/persistence/helpers.mjs";

const roots = [];

async function dataRoot(label) {
  const root = await mkdtemp(join(tmpdir(), `aseos-p1-o05-fault-${label}-`));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("P1-O05 crash recovery and storage fault injection", () => {
  test("rolls back a worker-terminated pre-commit transaction", async () => {
    const root = await dataRoot("crash-before");
    const worker = await PersistenceWorker.open({ dataRoot: root });
    await worker.armCrashBeforeCommitForQualification(
      makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 1 }),
    );
    await worker.terminateForQualification();

    const recovered = await PersistenceWorker.open({ dataRoot: root });
    try {
      await expect(recovered.recover()).resolves.toMatchObject({
        eventCount: 0,
        commandCount: 0,
        pendingOutboxCount: 0,
        auditCount: 0,
        integrity: "ok",
      });
    } finally {
      await recovered.close();
    }
  });

  test("recovers committed authority after worker termination without graceful drain", async () => {
    const root = await dataRoot("crash-after");
    const worker = await PersistenceWorker.open({ dataRoot: root });
    const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 2 });
    await worker.commit(batch);
    await worker.terminateForQualification();

    const recovered = await PersistenceWorker.open({ dataRoot: root });
    try {
      await expect(
        recovered.readEvents("QualificationStream", "qualification-stream"),
      ).resolves.toEqual(batch.events);
      await expect(recovered.recover()).resolves.toMatchObject({
        eventCount: 2,
        commandCount: 1,
        pendingOutboxCount: 1,
        auditCount: 1,
        integrity: "ok",
      });
    } finally {
      await recovered.close();
    }
  });

  test("fails with a typed busy result and succeeds after the authority lock is released", async () => {
    const root = await dataRoot("locked");
    const locker = await PersistenceWorker.open({ dataRoot: root, busyTimeoutMs: 100 });
    const contender = await PersistenceWorker.open({ dataRoot: root, busyTimeoutMs: 100 });
    try {
      await locker.holdWriteLockForQualification();
      const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 1 });
      await expect(contender.commit(batch)).rejects.toMatchObject({ code: "PERSISTENCE_BUSY" });
      await locker.releaseWriteLockForQualification();
      await expect(contender.commit(batch)).resolves.toMatchObject({ committedVersion: 1 });
    } finally {
      await locker.close();
      await contender.close();
    }
  });

  test("quarantines corruption and never replaces it with an empty authority database", async () => {
    const root = await dataRoot("corrupt");
    const state = join(root, "state");
    const databasePath = join(state, "aseos.db");
    await mkdir(state, { recursive: true });
    await writeFile(databasePath, "not-a-sqlite-database", "utf8");

    let quarantinePath;
    try {
      await PersistenceWorker.open({ dataRoot: root });
      throw new Error("Expected corruption to fail closed");
    } catch (error) {
      expect(error).toMatchObject({ code: "PERSISTENCE_CORRUPTION" });
      quarantinePath = error.details?.quarantinePath;
    }
    expect(typeof quarantinePath).toBe("string");
    await expect(stat(quarantinePath)).resolves.toMatchObject({ size: 21 });
    await expect(stat(databasePath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
