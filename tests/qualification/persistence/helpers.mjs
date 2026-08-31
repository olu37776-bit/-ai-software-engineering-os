import { canonicalJsonSha256 } from "@aseos/contracts";

const schemaRef = Object.freeze({
  schemaId: "urn:aseos:schema:fixture-change-node-contract:1.0.0",
  schemaVersion: "1.0.0",
  schemaHash: "2d471f657b7369e670d7801ea58b727b70fe1ca1eeac70545f1eb9792a5298f6",
});

export function qualificationUuid(index, namespace = 0) {
  const group = namespace.toString(16).padStart(4, "0").slice(-4);
  const suffix = (BigInt(namespace) * 1_000_000n + BigInt(index))
    .toString(16)
    .padStart(12, "0")
    .slice(-12);
  return `0198e0a1-${group}-7000-8000-${suffix}`;
}

export function makeJournalBatch({
  sequence,
  expectedVersion,
  eventCount,
  aggregateId = "qualification-stream",
  aggregateType = "QualificationStream",
  outboxCount = 1,
}) {
  const events = Array.from({ length: eventCount }, (_, index) => {
    const payload = { sequence: expectedVersion + index + 1 };
    return {
      schemaVersion: "1.0.0",
      eventId: qualificationUuid(sequence * 2_000 + index, 1),
      eventType: "QualificationEvent",
      aggregateType,
      aggregateId,
      aggregateVersion: expectedVersion + index + 1,
      occurredAt: "2026-08-31T00:00:00.000Z",
      actor: {
        actorId: "p1-o05-qualification",
        actorType: "SYSTEM",
        actorVersion: "1.0.0",
      },
      causationId: qualificationUuid(sequence, 2),
      correlationId: qualificationUuid(sequence, 3),
      payloadSchema: schemaRef,
      payloadHash: canonicalJsonSha256(payload),
      payload,
    };
  });
  const outbox = Array.from({ length: outboxCount }, (_, index) => {
    const payload = { sequence, index };
    return {
      schemaVersion: "1.0.0",
      taskId: qualificationUuid(sequence * 2_000 + index, 4),
      executionId: qualificationUuid(sequence * 2_000 + index, 5),
      attempt: 1,
      correlationId: qualificationUuid(sequence, 3),
      causationId: qualificationUuid(sequence, 2),
      idempotencyKey: `p1-o05-outbox-${String(sequence).padStart(8, "0")}-${String(index)}`,
      effectScope: `qualification/outbox/${String(sequence)}/${String(index)}`,
      capability: "qualification-noop",
      permissionSet: [],
      requiredIsolationLevel: "PROCESS_RESTRICTED",
      inputArtifactRefs: [],
      timeoutMs: 1_000,
      resourceBudget: {
        maxMemoryBytes: 1_048_576,
        maxProcessCount: 1,
        maxOutputBytes: 1_024,
        networkMode: "DENY",
      },
      adapterContractVersion: "1.0.0",
      payloadSchema: schemaRef,
      payloadHash: canonicalJsonSha256(payload),
      payload,
    };
  });
  const commandPayload = { sequence, aggregateId, expectedVersion, eventCount };
  return {
    schemaVersion: "1.0.0",
    transactionId: qualificationUuid(sequence, 6),
    commandId: qualificationUuid(sequence, 7),
    idempotencyKey: `p1-o05-command-${String(sequence).padStart(12, "0")}`,
    effectScope: `qualification/command/${aggregateId}`,
    payloadHash: canonicalJsonSha256(commandPayload),
    stream: { aggregateType, aggregateId, expectedVersion },
    events,
    outbox,
    audit: [
      {
        auditId: qualificationUuid(sequence, 8),
        occurredAt: "2026-08-31T00:00:00.000Z",
        action: "PERSISTENCE_COMMIT",
        payloadHash: canonicalJsonSha256({ sequence, eventCount }),
      },
    ],
    capturedAt: "2026-08-31T00:00:00.000Z",
  };
}
