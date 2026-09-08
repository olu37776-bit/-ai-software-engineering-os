import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { PersistenceWorker } from "@aseos/persistence";
import {
  bindResult,
  createResultFixture,
} from "../../qualification/persistence/p2-result-journal-helpers.mjs";

const roots = [];
const workers = new Set();
async function open(root) {
  const worker = await PersistenceWorker.open({ dataRoot: root });
  workers.add(worker);
  return worker;
}
afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("P2-O02 atomic result crash boundary", () => {
  test("kill before commit rolls back journal, inbox, receipt, audit and checkpoint together", async () => {
    const root = await mkdtemp(join(tmpdir(), "aseos-p2-result-crash-"));
    roots.push(root);
    const writer = await open(root);
    const observer = await open(root);
    const { scheduled, input, task } = await createResultFixture();
    await writer.commit(scheduled);
    const nextTask = {
      ...task,
      taskId: "0198e0a1-0000-7000-8000-000000099001",
      idempotencyKey: "result-crash-next-task",
      effectScope: "result-crash/next-task",
      causationId: input.batch.commandId,
    };
    input.batch.outbox = [nextTask];
    input.checkpoint = {
      schemaVersion: "1.0.0",
      projectionName: "result-crash",
      projectionVersion: "1.0.0",
      sourceSequence: 2,
      rebuiltFromSequence: null,
      updatedAt: input.batch.capturedAt,
    };
    bindResult(input);
    await writer.armResultCrashBeforeCommitForQualification(input);
    expect(await observer.recover()).toMatchObject({
      eventCount: 1,
      commandCount: 1,
      inboxCount: 0,
      auditCount: 1,
      checkpointCount: 0,
      pendingOutboxCount: 1,
    });
    await writer.terminateForQualification();
    workers.delete(writer);
    await observer.close();
    workers.delete(observer);
    const recovered = await open(root);
    expect(await recovered.recover()).toMatchObject({
      eventCount: 1,
      commandCount: 1,
      inboxCount: 0,
      auditCount: 1,
      checkpointCount: 0,
      pendingOutboxCount: 1,
    });
    expect(await recovered.listPendingOutboxTasks()).toEqual([task]);
    expect(await recovered.getCommandDedup(input.result.resultId)).toBeNull();
    await recovered.commitResult(input);
    expect(await recovered.recover()).toMatchObject({
      eventCount: 2,
      commandCount: 2,
      inboxCount: 1,
      auditCount: 2,
      checkpointCount: 1,
      pendingOutboxCount: 1,
    });
    expect(await recovered.listPendingOutboxTasks()).toEqual([nextTask]);
  });

  test("lost response after durable commit returns the original receipt following abrupt worker loss", async () => {
    const root = await mkdtemp(join(tmpdir(), "aseos-p2-result-response-"));
    roots.push(root);
    const writer = await open(root);
    const { scheduled, input } = await createResultFixture();
    await writer.commit(scheduled);
    const originallyPersisted = await writer.commitResult(input);
    await writer.terminateForQualification();
    workers.delete(writer);
    const recovered = await open(root);
    expect(await recovered.commitResult(input)).toEqual(originallyPersisted);
    expect(await recovered.recover()).toMatchObject({
      eventCount: 2,
      commandCount: 2,
      inboxCount: 1,
      auditCount: 2,
      pendingOutboxCount: 0,
    });
  });
});
