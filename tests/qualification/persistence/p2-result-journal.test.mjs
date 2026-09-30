import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { canonicalJsonSha256 } from "@aseos/contracts";
import { PersistenceWorker } from "@aseos/persistence";
import { qualificationUuid } from "./helpers.mjs";
import { bindResult, clone, createResultFixture } from "./p2-result-journal-helpers.mjs";

const roots = [];
const workers = new Set();
async function open(root) {
  const worker = await PersistenceWorker.open({ dataRoot: root });
  workers.add(worker);
  return worker;
}
async function setup(schedule = true) {
  const root = await mkdtemp(join(tmpdir(), "aseos-p2-result-"));
  roots.push(root);
  const worker = await open(root);
  const fixture = await createResultFixture();
  if (schedule) await worker.commit(fixture.scheduled);
  return { root, worker, ...fixture };
}
afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});
const expectedScheduled = {
  eventCount: 1,
  commandCount: 1,
  auditCount: 1,
  inboxCount: 0,
  pendingOutboxCount: 1,
};

describe("P2-O02 atomic result journal", () => {
  test("canonical contract fixtures resolve scheduling-event causation to its original receipt", async () => {
    const { worker } = await setup(false);
    const read = async (name) =>
      JSON.parse(
        await readFile(
          new URL(
            `../../../packages/contracts/examples/persistence/valid/${name}`,
            import.meta.url,
          ),
          "utf8",
        ),
      );
    const scheduled = await read("result-journal-scheduled-batch.json");
    const input = await read("result-journal-append-batch.json");
    await worker.commit(scheduled);
    const receipt = await worker.commitResult(input);
    expect(receipt.committedVersion).toBe(2);
    expect(await worker.commitResult(input)).toEqual(receipt);
    expect(await worker.listPendingOutboxTasks()).toEqual([]);
  });

  test("checkpoint regression rolls back result and preserves the earlier checkpoint", async () => {
    const { worker, input } = await setup();
    const checkpoint = {
      schemaVersion: "1.0.0",
      projectionName: "existing-projection",
      projectionVersion: "1.0.0",
      sourceSequence: 2,
      rebuiltFromSequence: null,
      updatedAt: input.batch.capturedAt,
    };
    await worker.saveProjectionCheckpoint(checkpoint);
    input.checkpoint = { ...checkpoint, sourceSequence: 1 };
    bindResult(input);
    await expect(worker.commitResult(input)).rejects.toMatchObject({
      code: "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
    });
    expect(await worker.recover()).toMatchObject({ ...expectedScheduled, checkpointCount: 1 });
    input.checkpoint = checkpoint;
    bindResult(input);
    await worker.commitResult(input);
    expect(await worker.recover()).toMatchObject({ inboxCount: 1, checkpointCount: 1 });
  });

  test("captures caller result metadata before asynchronous work", async () => {
    const { worker, input } = await setup();
    const original = clone(input);
    const pending = worker.commitResult(input);
    input.result.adapterId = "mutated-after-call";
    input.batch.events[0].payload.adapterId = "mutated-after-call";
    const receipt = await pending;
    expect(await worker.commitResult(original)).toEqual(receipt);
    expect(
      (
        await worker.readEvents(
          original.batch.stream.aggregateType,
          original.batch.stream.aggregateId,
        )
      )[1].payload,
    ).toEqual(original.result);
  });
  test("recovers scheduled tasks and commits result/inbox/audit/receipt/checkpoint atomically", async () => {
    const { root, worker, input, task } = await setup();
    expect(await worker.listPendingOutboxTasks()).toEqual([task]);
    await worker.close();
    workers.delete(worker);
    const restarted = await open(root);
    expect(await restarted.listPendingOutboxTasks()).toEqual([task]);
    input.checkpoint = {
      schemaVersion: "1.0.0",
      projectionName: "result-qualification",
      projectionVersion: "1.0.0",
      sourceSequence: 2,
      rebuiltFromSequence: null,
      updatedAt: input.batch.capturedAt,
    };
    bindResult(input);
    const receipt = await restarted.commitResult(input);
    expect(receipt.committedVersion).toBe(2);
    expect(await restarted.recover()).toMatchObject({
      eventCount: 2,
      commandCount: 2,
      auditCount: 2,
      inboxCount: 1,
      checkpointCount: 1,
      pendingOutboxCount: 0,
    });
    expect(await restarted.listPendingOutboxTasks()).toEqual([]);
    expect(
      (
        await restarted.readEvents(input.batch.stream.aggregateType, input.batch.stream.aggregateId)
      )[1].payload,
    ).toEqual(input.result);
    await restarted.close();
    workers.delete(restarted);
    const recovered = await open(root);
    expect(await recovered.commitResult(input)).toEqual(receipt);
    const regenerated = clone(input);
    regenerated.batch.transactionId = qualificationUuid(90001);
    regenerated.batch.events[0].eventId = qualificationUuid(90002);
    regenerated.batch.audit[0].auditId = qualificationUuid(90003);
    expect(await recovered.commitResult(regenerated)).toEqual(receipt);
    expect((await recovered.stateSchemaManifest()).databaseSchemaVersion).toBe(1);
  });

  test("unknown task and mismatched execution/attempt/correlation/stream write nothing", async () => {
    const empty = await setup(false);
    await expect(empty.worker.commitResult(empty.input)).rejects.toMatchObject({
      code: "PERSISTENCE_CONTRACT_INVALID",
    });
    expect(await empty.worker.recover()).toMatchObject({
      eventCount: 0,
      inboxCount: 0,
      commandCount: 0,
      auditCount: 0,
    });
    const { worker, input } = await setup();
    for (const mutate of [
      (value) => {
        value.result.executionId = qualificationUuid(91000);
      },
      (value) => {
        value.result.attempt += 1;
      },
      (value) => {
        value.result.correlationId = qualificationUuid(91001);
      },
      (value) => {
        value.batch.stream.aggregateId = "wrong-stream";
      },
    ]) {
      const candidate = clone(input);
      mutate(candidate);
      bindResult(candidate);
      await expect(worker.commitResult(candidate)).rejects.toMatchObject({
        code: "PERSISTENCE_CONTRACT_INVALID",
      });
      expect(await worker.recover()).toMatchObject(expectedScheduled);
    }
  });

  test("rejects schema, nested hash, unsafe attempt, reversed times and event binding before writes", async () => {
    const { worker, input } = await setup();
    for (const mutate of [
      (value) => {
        value.extra = true;
      },
      (value) => {
        value.result.payloadHash = "0".repeat(64);
        bindResult(value);
      },
      (value) => {
        value.result.payloadSchema.schemaHash = "0".repeat(64);
        bindResult(value);
      },
      (value) => {
        value.result.attempt = Number.MAX_SAFE_INTEGER + 1;
        bindResult(value);
      },
      (value) => {
        value.result.startedAt = "2027-01-01T00:00:00Z";
        bindResult(value);
      },
      (value) => {
        value.batch.events[0].causationId = qualificationUuid(92001);
      },
      (value) => {
        value.batch.payloadHash = input.result.payloadHash;
      },
    ]) {
      const candidate = clone(input);
      mutate(candidate);
      await expect(worker.commitResult(candidate)).rejects.toMatchObject({
        code: "PERSISTENCE_CONTRACT_INVALID",
      });
    }
    expect(await worker.recover()).toMatchObject(expectedScheduled);
  });

  test("same task changed result identity or envelope metadata is a durable conflict", async () => {
    const { worker, input } = await setup();
    await worker.commitResult(input);
    for (const mutate of [
      (value) => {
        value.result.resultId = qualificationUuid(93001);
      },
      (value) => {
        value.result.adapterId = "other-adapter";
      },
      (value) => {
        value.result.completedAt = "2026-08-26T08:10:04Z";
      },
      (value) => {
        value.result.evidenceRefs[0].subjectId = qualificationUuid(93002);
      },
    ]) {
      const candidate = clone(input);
      mutate(candidate);
      bindResult(candidate);
      await expect(worker.commitResult(candidate)).rejects.toMatchObject({
        code: "PERSISTENCE_IDEMPOTENCY_CONFLICT",
      });
    }
    expect(await worker.recover()).toMatchObject({
      eventCount: 2,
      inboxCount: 1,
      commandCount: 2,
      auditCount: 2,
    });
  });

  test("legacy orphan inbox cannot be reclassified as an atomic result commit", async () => {
    const { worker, input } = await setup();
    await worker.recordInbox({
      schemaVersion: "1.0.0",
      resultId: input.result.resultId,
      taskId: input.result.taskId,
      payloadHash: canonicalJsonSha256(input.result),
      status: "ACCEPTED",
      receivedAt: input.batch.capturedAt,
    });
    await expect(worker.commitResult(input)).rejects.toMatchObject({
      code: "PERSISTENCE_IDEMPOTENCY_CONFLICT",
    });
    expect(await worker.recover()).toMatchObject({
      eventCount: 1,
      commandCount: 1,
      inboxCount: 1,
      auditCount: 1,
    });
  });

  test("concurrent exact results from separate workers return one original receipt", async () => {
    const { root, worker, input } = await setup();
    const other = await open(root);
    const [first, second] = await Promise.all([
      worker.commitResult(input),
      other.commitResult(input),
    ]);
    expect(first).toEqual(second);
    expect(await worker.recover()).toMatchObject({
      eventCount: 2,
      commandCount: 2,
      inboxCount: 1,
      auditCount: 2,
      pendingOutboxCount: 0,
    });
  });

  test("concurrent different results for one task have one winner", async () => {
    const { root, worker, input } = await setup();
    const other = await open(root);
    const changed = clone(input);
    changed.result.resultId = qualificationUuid(94001);
    bindResult(changed);
    const outcomes = await Promise.allSettled([
      worker.commitResult(input),
      other.commitResult(changed),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected").reason.code).toBe(
      "PERSISTENCE_IDEMPOTENCY_CONFLICT",
    );
    expect(await worker.recover()).toMatchObject({
      eventCount: 2,
      commandCount: 2,
      inboxCount: 1,
      auditCount: 2,
    });
  });

  test("audit conflict, checkpoint failure and optimistic conflict roll back the entire result", async () => {
    const { worker, input, scheduled } = await setup();
    const badAudit = clone(input);
    badAudit.batch.audit[0].auditId = scheduled.audit[0].auditId;
    await expect(worker.commitResult(badAudit)).rejects.toMatchObject({
      code: "PERSISTENCE_STORAGE_FAILURE",
    });
    expect(await worker.recover()).toMatchObject(expectedScheduled);
    const badCheckpoint = clone(input);
    badCheckpoint.checkpoint = {
      schemaVersion: "1.0.0",
      projectionName: "result-qualification",
      projectionVersion: "1.0.0",
      sourceSequence: 999,
      rebuiltFromSequence: null,
      updatedAt: input.batch.capturedAt,
    };
    bindResult(badCheckpoint);
    await expect(worker.commitResult(badCheckpoint)).rejects.toMatchObject({
      code: "PERSISTENCE_CONTRACT_INVALID",
    });
    expect(await worker.recover()).toMatchObject({ ...expectedScheduled, checkpointCount: 0 });
    const wrongVersion = clone(input);
    wrongVersion.batch.stream.expectedVersion = 5;
    bindResult(wrongVersion);
    await expect(worker.commitResult(wrongVersion)).rejects.toMatchObject({
      code: "PERSISTENCE_OPTIMISTIC_CONCURRENCY",
    });
    expect(await worker.recover()).toMatchObject(expectedScheduled);
    expect(await worker.getCommandDedup(input.result.resultId)).toBeNull();
    await worker.commitResult(input);
    expect(await worker.listPendingOutboxTasks()).toEqual([]);
  });

  test("duplicate identity binds requested checkpoint and newly scheduled outbox effects", async () => {
    const { worker, input, task } = await setup();
    const nextTask = {
      ...clone(task),
      taskId: qualificationUuid(97001),
      idempotencyKey: "next-result-task",
      effectScope: "result-test/next",
      causationId: input.batch.commandId,
    };
    input.batch.outbox = [nextTask];
    input.checkpoint = {
      schemaVersion: "1.0.0",
      projectionName: "result-effects",
      projectionVersion: "1.0.0",
      sourceSequence: 2,
      rebuiltFromSequence: null,
      updatedAt: input.batch.capturedAt,
    };
    bindResult(input);
    const receipt = await worker.commitResult(input);
    expect(receipt.outboxTaskIds).toEqual([nextTask.taskId]);
    expect(await worker.listPendingOutboxTasks()).toEqual([nextTask]);
    for (const mutate of [
      (value) => {
        value.checkpoint.sourceSequence = 1;
      },
      (value) => {
        delete value.checkpoint;
      },
      (value) => {
        value.batch.outbox = [];
      },
      (value) => {
        value.batch.outbox[0].taskId = qualificationUuid(97002);
      },
    ]) {
      const changed = clone(input);
      mutate(changed);
      bindResult(changed);
      await expect(worker.commitResult(changed)).rejects.toMatchObject({
        code: "PERSISTENCE_IDEMPOTENCY_CONFLICT",
      });
    }
    expect(await worker.commitResult(input)).toEqual(receipt);
    expect(await worker.recover()).toMatchObject({
      eventCount: 2,
      inboxCount: 1,
      checkpointCount: 1,
      pendingOutboxCount: 1,
    });
  });

  test("unknown outcome is preserved as a result fact without automatic retry or invented success", async () => {
    const { worker, input } = await setup();
    input.result.outcome = "UNKNOWN_REQUIRES_RECONCILIATION";
    input.result.error = {
      code: "RESULT_UNKNOWN",
      category: "RECONCILIATION",
      message: "External outcome is unknown",
      retryability: "UNKNOWN",
    };
    bindResult(input);
    const receipt = await worker.commitResult(input);
    const events = await worker.readEvents(
      input.batch.stream.aggregateType,
      input.batch.stream.aggregateId,
    );
    expect(events[1].payload.outcome).toBe("UNKNOWN_REQUIRES_RECONCILIATION");
    expect(receipt.outboxTaskIds).toEqual([]);
    expect(await worker.listPendingOutboxTasks()).toEqual([]);
    expect(await worker.commitResult(input)).toEqual(receipt);
  });
});
