import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PersistenceWorker } from "@aseos/persistence";
import { expect, test } from "vitest";

import { makeJournalBatch } from "../qualification/persistence/helpers.mjs";

test("canonical JSON rejection reaches the durable journal boundary without partial writes", async () => {
  const dataRoot = await mkdtemp(join(tmpdir(), "aseos-p1-integrated-json-"));
  const worker = await PersistenceWorker.open({ dataRoot });
  try {
    const batch = makeJournalBatch({
      sequence: 1,
      expectedVersion: 0,
      eventCount: 1,
      outboxCount: 1,
    });
    batch.events[0].payload = { items: Array(2) };
    await expect(worker.commit(batch)).rejects.toMatchObject({
      code: "PERSISTENCE_CONTRACT_INVALID",
      message: "Batch is not canonical JSON",
    });
    expect(await worker.readEvents(batch.stream.aggregateType, batch.stream.aggregateId)).toEqual(
      [],
    );
    expect(await worker.listOutbox()).toEqual([]);
    expect(await worker.getCommandDedup(batch.commandId)).toBeNull();
    expect(await worker.recover()).toMatchObject({
      eventCount: 0,
      commandCount: 0,
      pendingOutboxCount: 0,
      auditCount: 0,
    });
    await worker.commit(
      makeJournalBatch({ sequence: 1, expectedVersion: 0, eventCount: 1, outboxCount: 1 }),
    );
    expect((await worker.recover()).eventCount).toBe(1);
  } finally {
    await worker.close();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
