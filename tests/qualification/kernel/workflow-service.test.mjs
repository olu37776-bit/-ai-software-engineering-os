import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, describe, expect, test } from "vitest";

import { canonicalJsonSha256, loadContractRegistry } from "@aseos/contracts";
import { PersistenceWorker } from "@aseos/persistence";
import { WorkflowService } from "@aseos/platform";

const roots = [];
const workers = new Set();
let registry;
let fixture;
let nextId = 1;

function uuid(number) {
  return `0198e0a1-0000-7000-8000-${number.toString(16).padStart(12, "0")}`;
}

function command(overrides = {}) {
  return { ...JSON.parse(JSON.stringify(fixture)), ...overrides };
}

function service(persistence, options = {}) {
  return new WorkflowService({
    registry,
    persistence,
    now: () => "2026-09-09T00:00:00.000Z",
    createId: () => uuid(nextId++),
    ...options,
  });
}

async function open(root) {
  const worker = await PersistenceWorker.open({ dataRoot: root });
  workers.add(worker);
  return worker;
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "aseos-p2-workflow-"));
  roots.push(root);
  const worker = await open(root);
  return { root, worker, application: service(worker) };
}

beforeAll(async () => {
  registry = await loadContractRegistry();
  fixture = JSON.parse(
    await readFile(
      new URL(
        "../../../packages/contracts/examples/first-slice/valid/create-workflow-run.command.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});

afterEach(async () => {
  await Promise.all([...workers].map((worker) => worker.close()));
  workers.clear();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("P2 durable WorkflowRun first slice", () => {
  test("creates one event/audit and replays identical state and original receipt after SQLite restart", async () => {
    const { root, worker, application } = await setup();
    const input = command();
    const result = await application.execute(input);
    expect(result.receipt.committedVersion).toBe(1);
    expect(result.receipt.eventIds).toHaveLength(1);
    expect(result.receipt.auditIds).toHaveLength(1);
    expect(result.receipt.outboxTaskIds).toEqual([]);
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
    await worker.close();
    workers.delete(worker);

    const restarted = await open(root);
    const recoveredService = service(restarted);
    expect(await recoveredService.replay(input.aggregateId)).toEqual({
      state: result.state,
      version: 1,
    });
    expect(await recoveredService.execute(input)).toEqual(result);
    expect(await restarted.recover()).toMatchObject({
      eventCount: 1,
      commandCount: 1,
      auditCount: 1,
    });
  });

  test("rejects changed command identity, actor, stream and payload without duplicate writes", async () => {
    const { worker, application } = await setup();
    const original = command();
    await application.execute(original);
    const payload = { ...original.payload, workflowDefinitionId: "different-definition" };
    const variants = [
      command({ commandId: uuid(90001) }),
      command({ payload, payloadHash: canonicalJsonSha256(payload) }),
      command({ actor: { ...original.actor, actorId: "different-actor" } }),
      command({ aggregateId: "different-stream" }),
      command({ expectedVersion: 1 }),
      command({ idempotencyKey: "different-idempotency-key" }),
    ];
    for (const input of variants) {
      await expect(application.execute(input)).rejects.toMatchObject({
        code: "PERSISTENCE_IDEMPOTENCY_CONFLICT",
      });
    }
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
  });

  test("invalid admission and impossible version write no journal, command, audit or outbox rows", async () => {
    const { worker, application } = await setup();
    const badInputs = [
      null,
      command({ extra: true }),
      command({ payloadHash: "0".repeat(64) }),
      command({ payloadSchema: { ...fixture.payloadSchema, schemaHash: "0".repeat(64) } }),
      command({ commandType: "UnsupportedCommand" }),
      command({ aggregateType: "UnsupportedAggregate" }),
      command({ expectedVersion: Number.MAX_SAFE_INTEGER + 1 }),
      command({ expectedVersion: 1 }),
    ];
    for (const input of badInputs)
      await expect(application.execute(input)).rejects.toHaveProperty("code");
    expect(await worker.recover()).toMatchObject({
      eventCount: 0,
      commandCount: 0,
      auditCount: 0,
      pendingOutboxCount: 0,
    });
  });

  test("captures the caller's command before asynchronous admission work", async () => {
    const { worker, application } = await setup();
    const input = command();
    const original = JSON.parse(JSON.stringify(input));
    const pending = application.execute(input);
    input.aggregateId = "mutated-stream";
    input.payload.workflowDefinitionId = "mutated-definition";
    const result = await pending;
    expect(result.receipt.aggregateId).toBe(original.aggregateId);
    expect(await application.execute(original)).toEqual(result);
    expect(await worker.readEvents("WorkflowRun", "mutated-stream")).toEqual([]);
  });

  test("two independent SQLite workers racing distinct creates commit exactly one transition", async () => {
    const { root, worker, application } = await setup();
    const otherWorker = await open(root);
    const other = service(otherWorker);
    const outcomes = await Promise.allSettled([
      application.execute(command()),
      other.execute(
        command({ commandId: uuid(90002), idempotencyKey: "different-concurrent-key" }),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(["KERNEL_VERSION_CONFLICT", "PERSISTENCE_OPTIMISTIC_CONCURRENCY"]).toContain(
      rejected.reason.code,
    );
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
  });

  test("concurrent exact duplicates resolve to the same durable result", async () => {
    const { root, worker, application } = await setup();
    const other = service(await open(root));
    const [first, second] = await Promise.all([
      application.execute(command()),
      other.execute(command()),
    ]);
    expect(first).toEqual(second);
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
  });

  test("rejects a receipt with invalid hash or mismatched committed event binding", async () => {
    const { worker, application } = await setup();
    const original = await application.execute(command());
    for (const receipt of [
      { ...original.receipt, receiptHash: "0".repeat(64) },
      (() => {
        const base = { ...original.receipt };
        delete base.receiptHash;
        const changed = { ...base, eventIds: [uuid(92001)] };
        return { ...changed, receiptHash: canonicalJsonSha256(changed) };
      })(),
    ]) {
      const corruptedView = service({
        lookupCommandReceipt: async () => receipt,
        readEvents: (...args) => worker.readEvents(...args),
        commit: (batch) => worker.commit(batch),
      });
      await expect(corruptedView.execute(command())).rejects.toMatchObject({
        code: "KERNEL_REPLAY_INVALID",
      });
    }
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
  });

  test("recovers the exact receipt when a duplicate commits between lookup and replay", async () => {
    const { worker, application } = await setup();
    let racedResult;
    let firstRead = true;
    const raced = service({
      lookupCommandReceipt: (identity) => worker.lookupCommandReceipt(identity),
      commit: (batch) => worker.commit(batch),
      readEvents: async (...args) => {
        if (firstRead) {
          firstRead = false;
          racedResult = await application.execute(command());
        }
        return worker.readEvents(...args);
      },
    });
    expect(await raced.execute(command())).toEqual(racedResult);
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
  });

  test("an audit insert failure rolls back its event and dedup record, allowing a clean retry", async () => {
    const { worker } = await setup();
    const sharedAuditId = uuid(91000);
    const firstIds = [uuid(91001), sharedAuditId, uuid(91002)];
    await service(worker, { createId: () => firstIds.shift() }).execute(command());
    const secondCommand = command({
      aggregateId: "rollback-stream",
      commandId: uuid(91003),
      idempotencyKey: "rollback-command-key",
    });
    const conflictingIds = [uuid(91004), sharedAuditId, uuid(91005)];
    await expect(
      service(worker, { createId: () => conflictingIds.shift() }).execute(secondCommand),
    ).rejects.toMatchObject({ code: "PERSISTENCE_STORAGE_FAILURE" });
    expect(await worker.readEvents("WorkflowRun", "rollback-stream")).toEqual([]);
    expect(await worker.getCommandDedup(secondCommand.commandId)).toBeNull();
    expect(await worker.recover()).toMatchObject({ eventCount: 1, commandCount: 1, auditCount: 1 });
    expect((await service(worker).execute(secondCommand)).receipt.committedVersion).toBe(1);
    expect(await worker.recover()).toMatchObject({ eventCount: 2, commandCount: 2, auditCount: 2 });
  });
});
