import { beforeAll, describe, expect, test } from "vitest";
import {
  canonicalJsonSha256,
  loadContractRegistry,
  validateContractInventory,
} from "@aseos/contracts";
import { readJson, repositoryRoot } from "../helpers.mjs";

const schemaId = "urn:aseos:schema:result-journal-append-batch:1.0.0";
const identity = { schemaId, schemaVersion: "1.0.0" };
const fixtureRoot = "packages/contracts/examples/persistence/";
let registry;
let request;
let scheduled;
beforeAll(async () => {
  registry = await loadContractRegistry(repositoryRoot);
  request = await readJson(repositoryRoot, `${fixtureRoot}valid/result-journal-append-batch.json`);
  scheduled = await readJson(
    repositoryRoot,
    `${fixtureRoot}valid/result-journal-scheduled-batch.json`,
  );
});

describe("P2 additive ResultJournalAppendBatch boundary", () => {
  test("activates one canonical owner and resolves all existing nested schemas", async () => {
    const entry = registry.resolve(identity);
    expect(entry.authorityPath).toBe(
      "packages/contracts/schemas/persistence/result-journal-append-batch.schema.json",
    );
    expect(entry.examplesRequired).toBe(true);
    const inventory = await validateContractInventory(registry);
    expect(inventory.activeContracts.filter((item) => item.schemaId === schemaId)).toMatchObject([
      {
        contractId: "aseos.persistence.result-journal-append-batch",
        canonicalOwner: "packages/persistence",
        publicBoundary: true,
        persisted: true,
      },
    ]);
  });

  test("accepts the request with and without its optional checkpoint", () => {
    expect(registry.validate(identity, request).ok).toBe(true);
    const withoutCheckpoint = { ...request };
    delete withoutCheckpoint.checkpoint;
    expect(registry.validate(identity, withoutCheckpoint).ok).toBe(true);
  });

  test("binds the example result to its scheduled task and entire recording command identity", () => {
    expect(
      registry.validate(
        { schemaId: "urn:aseos:schema:journal-append-batch:1.0.0", schemaVersion: "1.0.0" },
        scheduled,
      ).ok,
    ).toBe(true);
    const task = scheduled.outbox[0];
    const { batch, result } = request;
    expect([result.taskId, result.executionId, result.attempt, result.correlationId]).toEqual([
      task.taskId,
      task.executionId,
      task.attempt,
      task.correlationId,
    ]);
    expect(task.causationId).toBe(scheduled.events[0].eventId);
    expect(batch.stream).toEqual({ ...scheduled.stream, expectedVersion: 1 });
    expect(batch.commandId).toBe(result.resultId);
    expect(batch.idempotencyKey).toBe(`worker-result:${result.taskId}`);
    expect(batch.effectScope).toBe(`WorkerResult:${result.taskId}`);
    expect(batch.payloadHash).toBe(
      canonicalJsonSha256({
        commandType: "RecordSideEffectResult",
        result,
        stream: batch.stream,
        outbox: batch.outbox,
        checkpoint: request.checkpoint ?? null,
      }),
    );
    expect(batch.events).toHaveLength(1);
    const event = batch.events[0];
    expect(event.eventType).toBe("SideEffectResultRecorded");
    expect(event.payload).toEqual(result);
    expect(event.payloadHash).toBe(canonicalJsonSha256(result));
    expect(event.causationId).toBe(batch.commandId);
    expect(event.correlationId).toBe(result.correlationId);
    expect(event.aggregateVersion).toBe(2);
    expect(registry.validate(event.payloadSchema, event.payload).ok).toBe(true);
    expect(registry.resolve(event.payloadSchema).sha256).toBe(event.payloadSchema.schemaHash);
    expect(registry.validate(result.payloadSchema, result.payload).ok).toBe(true);
    expect(registry.resolve(result.payloadSchema).sha256).toBe(result.payloadSchema.schemaHash);
    expect(result.payloadHash).toBe(canonicalJsonSha256(result.payload));
  });

  test("requires the result rather than accepting an ordinary journal batch", async () => {
    const missing = await readJson(
      repositoryRoot,
      `${fixtureRoot}invalid/result-journal-missing-result.json`,
    );
    const validation = registry.validate(identity, missing);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ keyword: "required", instancePath: "" })]),
    );
    expect(registry.validate(identity, scheduled).ok).toBe(false);
  });

  test.each([
    [
      "root extra field",
      (value) => {
        value.unexpected = true;
      },
    ],
    [
      "unsupported request version",
      (value) => {
        value.schemaVersion = "2.0.0";
      },
    ],
    [
      "missing event journal",
      (value) => {
        delete value.batch;
      },
    ],
    [
      "null checkpoint",
      (value) => {
        value.checkpoint = null;
      },
    ],
    [
      "unsafe checkpoint sequence",
      (value) => {
        value.checkpoint.sourceSequence = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "nested journal extra field",
      (value) => {
        value.batch.unexpected = true;
      },
    ],
    [
      "nested result extra field",
      (value) => {
        value.result.unexpected = true;
      },
    ],
    [
      "nested checkpoint extra field",
      (value) => {
        value.checkpoint.unexpected = true;
      },
    ],
    [
      "result zero attempt",
      (value) => {
        value.result.attempt = 0;
      },
    ],
    [
      "result unknown outcome",
      (value) => {
        value.result.outcome = "UNRECOGNIZED";
      },
    ],
  ])("rejects %s at the canonical schema boundary", (_name, mutate) => {
    const changed = globalThis.structuredClone(request);
    mutate(changed);
    expect(registry.validate(identity, changed).ok).toBe(false);
  });
});
