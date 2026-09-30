import { readFile } from "node:fs/promises";
import { canonicalJsonSha256, loadContractRegistry } from "@aseos/contracts";
import { makeJournalBatch } from "./helpers.mjs";

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function bindResult(input) {
  const { batch, result } = input;
  batch.commandId = result.resultId;
  batch.idempotencyKey = `worker-result:${result.taskId}`;
  batch.effectScope = `WorkerResult:${result.taskId}`;
  batch.payloadHash = canonicalJsonSha256({
    commandType: "RecordSideEffectResult",
    result,
    stream: batch.stream,
    outbox: batch.outbox,
    checkpoint: input.checkpoint ?? null,
  });
  const event = batch.events[0];
  event.aggregateType = batch.stream.aggregateType;
  event.aggregateId = batch.stream.aggregateId;
  event.aggregateVersion = batch.stream.expectedVersion + 1;
  event.causationId = result.resultId;
  event.correlationId = result.correlationId;
  event.payload = clone(result);
  event.payloadHash = canonicalJsonSha256(result);
  return input;
}

export async function createResultFixture() {
  const read = async (name) =>
    JSON.parse(
      await readFile(
        new URL(`../../../packages/contracts/examples/first-slice/valid/${name}`, import.meta.url),
        "utf8",
      ),
    );
  const task = await read("apply-change.side-effect-task.json");
  const result = await read("apply-change.side-effect-result.json");
  const scheduled = makeJournalBatch({
    sequence: 700,
    expectedVersion: 0,
    eventCount: 1,
    outboxCount: 0,
  });
  scheduled.commandId = task.causationId;
  scheduled.outbox = [task];
  const batch = makeJournalBatch({
    sequence: 701,
    expectedVersion: 1,
    eventCount: 1,
    outboxCount: 0,
  });
  const registry = await loadContractRegistry();
  const entry = registry.resolve({
    schemaId: "urn:aseos:schema:side-effect-result-envelope:1.0.0",
    schemaVersion: "1.0.0",
  });
  batch.events[0].eventType = "SideEffectResultRecorded";
  batch.events[0].payloadSchema = {
    schemaId: entry.schemaId,
    schemaVersion: entry.schemaVersion,
    schemaHash: entry.sha256,
  };
  return { scheduled, task, input: bindResult({ schemaVersion: "1.0.0", batch, result }) };
}
