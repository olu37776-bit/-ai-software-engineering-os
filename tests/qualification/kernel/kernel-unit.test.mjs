import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, test } from "vitest";
import { canonicalJsonSha256, loadContractRegistry } from "@aseos/contracts";
import { commandIdentity, DeterministicKernel, KernelError } from "@aseos/kernel";
import { workflowRunDefinition } from "@aseos/workflow";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const fixtureUrl = new URL(
  "../../../packages/contracts/examples/first-slice/valid/create-workflow-run.command.json",
  import.meta.url,
);
const context = {
  eventId: "0198e0a1-0000-7004-8004-000000000004",
  auditId: "0198e0a1-0000-7005-8005-000000000005",
  transactionId: "0198e0a1-0000-7006-8006-000000000006",
  occurredAt: "2026-09-09T00:00:00Z",
};
let kernel;
let fixture;
beforeAll(async () => {
  fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  kernel = new DeterministicKernel(
    await loadContractRegistry(repositoryRoot),
    workflowRunDefinition,
  );
});

function rejects(operation, code) {
  assert.throws(operation, (error) => error instanceof KernelError && error.code === code);
}

describe("deterministic first-slice kernel", () => {
  test("identical explicit inputs give identical event, batch and recovered state", () => {
    const first = kernel.prepare(fixture, [], context);
    assert.deepEqual(first, kernel.prepare(fixture, [], context));
    assert.deepEqual(kernel.replay(fixture.aggregateId, first.events), {
      state: first.state,
      version: 1,
    });
    assert.equal(first.state.status, "CREATED");
    assert.equal(first.events[0].causationId, fixture.commandId);
    assert.equal(first.events[0].payload.createdByCommandId, fixture.commandId);
    assert.equal(first.events[0].payloadHash, canonicalJsonSha256(first.events[0].payload));
    assert.equal(first.batch.audit.length, 1);
    assert.deepEqual(first.batch.outbox, []);
  });

  test("admission captures deeply immutable JSON before caller mutation", () => {
    const input = globalThis.structuredClone(fixture);
    const admitted = kernel.admitCommand(input);
    input.payload.workflowDefinitionId = "changed-after-admission";
    assert.equal(admitted.payload.workflowDefinitionId, fixture.payload.workflowDefinitionId);
    assert.ok(Object.isFrozen(admitted.payload.inputArtifactRef));
    const prepared = kernel.prepare(admitted, [], context);
    assert.ok(Object.isFrozen(prepared.batch.events[0].payload));
  });

  test("dedup identity hashes complete command including actor/version/schema/stream", () => {
    const identity = commandIdentity(kernel.admitCommand(fixture));
    assert.equal(identity.payloadHash, canonicalJsonSha256(fixture));
    assert.notEqual(identity.payloadHash, fixture.payloadHash);
    for (const changed of [
      { ...fixture, expectedVersion: 1 },
      { ...fixture, aggregateId: "different-run" },
      { ...fixture, actor: { actorType: "SYSTEM", actorId: "different-actor" } },
    ])
      assert.notEqual(
        commandIdentity(kernel.admitCommand(changed)).payloadHash,
        identity.payloadHash,
      );
    assert.equal(kernel.prepare(fixture, [], context).batch.payloadHash, identity.payloadHash);
  });

  for (const [name, modify] of [
    [
      "unknown envelope field",
      (value) => {
        value.unexpected = true;
      },
    ],
    [
      "unsafe version",
      (value) => {
        value.expectedVersion = Number.MAX_SAFE_INTEGER + 1;
      },
    ],
    [
      "unincrementable version",
      (value) => {
        value.expectedVersion = Number.MAX_SAFE_INTEGER;
      },
    ],
    [
      "negative version",
      (value) => {
        value.expectedVersion = -1;
      },
    ],
    [
      "bad payload hash",
      (value) => {
        value.payloadHash = "0".repeat(64);
      },
    ],
    [
      "bad schema hash",
      (value) => {
        value.payloadSchema.schemaHash = "0".repeat(64);
      },
    ],
    [
      "wrong schema family",
      (value) => {
        value.payloadSchema.schemaId = "urn:aseos:schema:workflow-run-created-payload:1.0.0";
      },
    ],
    [
      "schema version mismatch",
      (value) => {
        value.payloadSchema.schemaVersion = "2.0.0";
      },
    ],
    [
      "malformed payload with recomputed hash",
      (value) => {
        value.payload.workflowDefinitionVersion = 42;
        value.payloadHash = canonicalJsonSha256(value.payload);
      },
    ],
  ])
    test(`rejects ${name}`, () => {
      const value = globalThis.structuredClone(fixture);
      modify(value);
      rejects(() => kernel.admitCommand(value), "KERNEL_CONTRACT_INVALID");
    });

  test("rejects unsupported aggregate/command pairs including prototype names", () => {
    for (const value of [
      { ...fixture, aggregateType: "OtherAggregate" },
      { ...fixture, commandType: "OtherCommand" },
      { ...fixture, commandType: "Constructor" },
    ])
      rejects(() => kernel.admitCommand(value), "KERNEL_UNSUPPORTED_COMMAND");
  });

  test("rejects accessors, cycles and non-JSON values without evaluating getters", () => {
    let evaluated = false;
    const accessor = { ...fixture };
    Object.defineProperty(accessor, "payload", {
      enumerable: true,
      get() {
        evaluated = true;
        return fixture.payload;
      },
    });
    rejects(() => kernel.admitCommand(accessor), "KERNEL_CONTRACT_INVALID");
    assert.equal(evaluated, false);
    const cycle = { ...fixture };
    cycle.payload = cycle;
    for (const value of [cycle, { ...fixture, payload: { value: undefined } }, new Date()]) {
      rejects(() => kernel.admitCommand(value), "KERNEL_CONTRACT_INVALID");
    }
  });

  test("rejects expected-version mismatch and repeated creation at current version", () => {
    const first = kernel.prepare(fixture, [], context);
    rejects(() => kernel.prepare(fixture, first.events, context), "KERNEL_VERSION_CONFLICT");
    rejects(
      () => kernel.prepare({ ...fixture, expectedVersion: 1 }, first.events, context),
      "KERNEL_DOMAIN_REJECTED",
    );
  });

  test("replay rejects unknown event type, wrong stream, version gaps and duplicate IDs", () => {
    const [event] = kernel.prepare(fixture, [], context).events;
    for (const changed of [
      { ...event, eventType: "UnknownEvent" },
      { ...event, aggregateType: "OtherAggregate" },
      { ...event, aggregateId: "another-run" },
      { ...event, aggregateVersion: 2 },
      { ...event, aggregateVersion: Number.MAX_SAFE_INTEGER + 1 },
    ])
      rejects(() => kernel.replay(fixture.aggregateId, [changed]), "KERNEL_REPLAY_INVALID");
    rejects(
      () => kernel.replay(fixture.aggregateId, [event, { ...event, aggregateVersion: 2 }]),
      "KERNEL_REPLAY_INVALID",
    );
  });

  test("replay validates event payload and its causation binding", () => {
    const [event] = kernel.prepare(fixture, [], context).events;
    rejects(
      () => kernel.replay(fixture.aggregateId, [{ ...event, payloadHash: "0".repeat(64) }]),
      "KERNEL_CONTRACT_INVALID",
    );
    const payload = { ...event.payload, createdByCommandId: context.eventId };
    rejects(
      () =>
        kernel.replay(fixture.aggregateId, [
          { ...event, payload, payloadHash: canonicalJsonSha256(payload) },
        ]),
      "KERNEL_REPLAY_INVALID",
    );
  });

  test("invalid injected IDs or time cannot escape as a prepared journal batch", () => {
    for (const bad of [
      { ...context, eventId: "not-a-uuid" },
      { ...context, auditId: "not-a-uuid" },
      { ...context, transactionId: "not-a-uuid" },
      { ...context, occurredAt: "not-a-time" },
    ])
      rejects(() => kernel.prepare(fixture, [], bad), "KERNEL_CONTRACT_INVALID");
  });
});
