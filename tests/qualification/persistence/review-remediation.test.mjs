import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, test } from "vitest";
import { canonicalJsonSha256 } from "@aseos/contracts";
import { PersistenceWorker } from "@aseos/persistence";
import { makeJournalBatch } from "./helpers.mjs";

const roots = [];
async function root() {
  const path = await mkdtemp(join(tmpdir(), "aseos-persistence-review-"));
  roots.push(path);
  return path;
}
afterEach(async () => {
  for (const path of roots.splice(0)) await rm(path, { force: true, recursive: true });
});

test.each(["events", "outbox"])(
  "rejects %s payload schema identity, hash and content before any durable write",
  async (collection) => {
    const worker = await PersistenceWorker.open({ dataRoot: await root() });
    try {
      const mutations = [
        (entry) => {
          entry.payloadSchema.schemaId = "urn:aseos:schema:unknown:1.0.0";
        },
        (entry) => {
          entry.payloadSchema.schemaVersion = "2.0.0";
        },
        (entry) => {
          entry.payloadSchema.schemaHash = "0".repeat(64);
        },
        (entry) => {
          entry.payload = { sequence: 1 };
          entry.payloadHash = canonicalJsonSha256(entry.payload);
        },
      ];
      for (const mutate of mutations) {
        const batch = makeJournalBatch({
          sequence: 1,
          expectedVersion: 0,
          eventCount: 2,
          outboxCount: 2,
        });
        batch[collection][1].payloadSchema = { ...batch[collection][1].payloadSchema };
        mutate(batch[collection][1]);
        await expect(worker.commit(batch)).rejects.toMatchObject({
          code: "PERSISTENCE_CONTRACT_INVALID",
        });
        expect(await worker.recover()).toMatchObject({
          eventCount: 0,
          commandCount: 0,
          pendingOutboxCount: 0,
          auditCount: 0,
        });
      }
      const valid = makeJournalBatch({ sequence: 2, expectedVersion: 0, eventCount: 1 });
      await worker.commit(valid);
      expect(await worker.readEvents(valid.stream.aggregateType, valid.stream.aggregateId)).toEqual(
        valid.events,
      );
    } finally {
      await worker.close();
    }
  },
);

test("caller mutation after commit starts cannot replace a validated payload", async () => {
  const worker = await PersistenceWorker.open({ dataRoot: await root() });
  try {
    const batch = makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 1 });
    const expected = globalThis.structuredClone(batch.events);
    const pending = worker.commit(batch);
    batch.events[0].payload = { invalid: true };
    batch.events[0].payloadHash = canonicalJsonSha256(batch.events[0].payload);
    await pending;
    expect(await worker.readEvents(batch.stream.aggregateType, batch.stream.aggregateId)).toEqual(
      expected,
    );
  } finally {
    await worker.close();
  }
});

test("invalid busy timeout leaves a healthy database byte-identical and immediately reopenable", async () => {
  const dataRoot = await root();
  const worker = await PersistenceWorker.open({ dataRoot });
  await worker.commit(makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 2 }));
  await worker.close();
  const path = join(dataRoot, "state", "aseos.db");
  const before = await readFile(path);
  await expect(PersistenceWorker.open({ dataRoot, busyTimeoutMs: 60_001 })).rejects.toMatchObject({
    code: "PERSISTENCE_CONTRACT_INVALID",
  });
  expect(await readFile(path)).toEqual(before);
  expect(await readdir(join(dataRoot, "state"))).toEqual(["aseos.db"]);
  const reopened = await PersistenceWorker.open({ dataRoot, busyTimeoutMs: 60_000 });
  try {
    expect(await reopened.recover()).toMatchObject({ eventCount: 2 });
  } finally {
    await reopened.close();
  }
});

test("an existing truncated database is quarantined instead of initialized as an empty authority", async () => {
  const dataRoot = await root();
  const worker = await PersistenceWorker.open({ dataRoot });
  await worker.commit(makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 2 }));
  await worker.close();
  await writeFile(join(dataRoot, "state", "aseos.db"), "");
  await expect(PersistenceWorker.open({ dataRoot })).rejects.toMatchObject({
    code: "PERSISTENCE_CORRUPTION",
  });
  expect(
    (await readdir(join(dataRoot, "state"))).some((name) => name.startsWith("aseos.db.corrupt-")),
  ).toBe(true);
  await expect(PersistenceWorker.open({ dataRoot })).rejects.toMatchObject({
    code: "PERSISTENCE_CORRUPTION",
    details: expect.objectContaining({ recoveryRequired: true }),
  });
});

test("an operational open failure preserves the original path without a corruption marker", async () => {
  const dataRoot = await root();
  await mkdir(join(dataRoot, "state", "aseos.db"), { recursive: true });
  await expect(PersistenceWorker.open({ dataRoot })).rejects.toMatchObject({
    code: "PERSISTENCE_STORAGE_FAILURE",
  });
  expect(await readdir(join(dataRoot, "state"))).toEqual(["aseos.db"]);
});
