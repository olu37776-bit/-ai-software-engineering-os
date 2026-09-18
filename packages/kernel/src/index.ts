import {
  canonicalJson,
  canonicalJsonSha256,
  type CommandEnvelope,
  type ContractRegistry,
  type DomainEventEnvelope,
  type JournalAppendBatch,
  type PersistenceCommitReceipt,
  type SchemaRef,
} from "@aseos/contracts";

export type KernelErrorCode =
  | "KERNEL_CONTRACT_INVALID"
  | "KERNEL_UNSUPPORTED_COMMAND"
  | "KERNEL_VERSION_CONFLICT"
  | "KERNEL_REPLAY_INVALID"
  | "KERNEL_DOMAIN_REJECTED";

export class KernelError extends Error {
  public constructor(
    public readonly code: KernelErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "KernelError";
  }
}

export type EventDecision = Readonly<{
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
}>;

/** Domain functions are synchronous and pure; clocks, IDs and storage stay outside. */
export type AggregateDefinition<State> = Readonly<{
  aggregateType: string;
  commandSchemas: Readonly<Record<string, string>>;
  eventSchemas: Readonly<Record<string, string>>;
  decide: (state: State | null, command: CommandEnvelope) => EventDecision;
  apply: (state: State | null, event: DomainEventEnvelope) => State;
}>;

export type ReplayResult<State> = Readonly<{ state: State | null; version: number }>;
export type TransitionContext = Readonly<{
  eventId: string;
  auditId: string;
  transactionId: string;
  occurredAt: string;
}>;
export type CommandIdentity = Pick<
  JournalAppendBatch,
  "commandId" | "idempotencyKey" | "effectScope" | "payloadHash"
>;

/** Public storage boundary; platform supplies its real persistence adapter. */
export interface KernelJournalPort {
  lookupCommandReceipt(identity: CommandIdentity): Promise<PersistenceCommitReceipt | null>;
  readEvents(aggregateType: string, aggregateId: string): Promise<readonly DomainEventEnvelope[]>;
  commit(batch: JournalAppendBatch): Promise<PersistenceCommitReceipt>;
}

export type PreparedTransition<State> = Readonly<{
  batch: JournalAppendBatch;
  state: State;
  events: readonly DomainEventEnvelope[];
}>;

export function commandIdentity(command: CommandEnvelope): CommandIdentity {
  return {
    commandId: command.commandId,
    idempotencyKey: command.idempotencyKey,
    effectScope: `${command.aggregateType}:${command.aggregateId}`,
    // Bind the entire admitted command, not merely its payload. Identity reuse
    // with changed actor, stream, schema or expected version is a conflict.
    payloadHash: canonicalJsonSha256(command),
  };
}

function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function snapshot<T>(value: T): T {
  try {
    return freezeJson(JSON.parse(canonicalJson(value)) as T);
  } catch {
    throw new KernelError("KERNEL_CONTRACT_INVALID", "Input must be canonical JSON data");
  }
}

export class DeterministicKernel<State> {
  public constructor(
    private readonly registry: ContractRegistry,
    private readonly domain: AggregateDefinition<State>,
  ) {}

  #validate(schemaId: string, value: unknown): unknown {
    const result = this.registry.validate({ schemaId, schemaVersion: "1.0.0" }, value);
    if (!result.ok) {
      throw new KernelError("KERNEL_CONTRACT_INVALID", `Rejected by schema ${schemaId}`);
    }
    return result.value;
  }

  #schemaRef(schemaId: string): SchemaRef {
    const entry = this.registry.resolve({ schemaId, schemaVersion: "1.0.0" });
    if ("ok" in entry) {
      throw new KernelError("KERNEL_CONTRACT_INVALID", `Unknown canonical schema ${schemaId}`);
    }
    return { schemaId, schemaVersion: entry.schemaVersion, schemaHash: entry.sha256 };
  }

  #validatePayload(envelope: CommandEnvelope | DomainEventEnvelope, requiredSchema: string): void {
    const reference = this.#schemaRef(requiredSchema);
    if (
      canonicalJson(reference) !== canonicalJson(envelope.payloadSchema) ||
      canonicalJsonSha256(envelope.payload) !== envelope.payloadHash
    ) {
      throw new KernelError("KERNEL_CONTRACT_INVALID", "Payload schema identity or hash mismatch");
    }
    this.#validate(requiredSchema, envelope.payload);
  }

  public admitCommand(input: unknown): CommandEnvelope {
    const command = this.#validate(
      "urn:aseos:schema:command-envelope:1.0.0",
      snapshot(input),
    ) as CommandEnvelope;
    const requiredSchema = Object.hasOwn(this.domain.commandSchemas, command.commandType)
      ? this.domain.commandSchemas[command.commandType]
      : undefined;
    if (command.aggregateType !== this.domain.aggregateType || requiredSchema === undefined) {
      throw new KernelError("KERNEL_UNSUPPORTED_COMMAND", "Unsupported aggregate/command pair");
    }
    if (
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion >= Number.MAX_SAFE_INTEGER
    ) {
      throw new KernelError(
        "KERNEL_CONTRACT_INVALID",
        "Expected version cannot be safely incremented",
      );
    }
    this.#validatePayload(command, requiredSchema);
    return command;
  }

  public replay(aggregateId: string, inputs: readonly unknown[]): ReplayResult<State> {
    if (typeof aggregateId !== "string" || aggregateId.length < 1 || aggregateId.length > 256) {
      throw new KernelError("KERNEL_REPLAY_INVALID", "Invalid aggregate identity");
    }
    const history = snapshot<readonly unknown[]>(inputs);
    if (!Array.isArray(history)) {
      throw new KernelError("KERNEL_REPLAY_INVALID", "History must be an event array");
    }
    let state: State | null = null;
    let version = 0;
    const eventIds = new Set<string>();
    for (const input of history) {
      const event = this.#validate(
        "urn:aseos:schema:domain-event-envelope:1.0.0",
        input,
      ) as DomainEventEnvelope;
      const requiredSchema = Object.hasOwn(this.domain.eventSchemas, event.eventType)
        ? this.domain.eventSchemas[event.eventType]
        : undefined;
      if (
        requiredSchema === undefined ||
        event.aggregateType !== this.domain.aggregateType ||
        event.aggregateId !== aggregateId ||
        !Number.isSafeInteger(event.aggregateVersion) ||
        event.aggregateVersion !== version + 1 ||
        eventIds.has(event.eventId)
      ) {
        throw new KernelError(
          "KERNEL_REPLAY_INVALID",
          "Event type, stream, ID or version invariant failed",
        );
      }
      this.#validatePayload(event, requiredSchema);
      state = freezeJson(this.domain.apply(state, event));
      version = event.aggregateVersion;
      eventIds.add(event.eventId);
    }
    return { state, version };
  }

  public prepare(
    input: unknown,
    history: readonly unknown[],
    suppliedContext: TransitionContext,
  ): PreparedTransition<State> {
    const command = this.admitCommand(input);
    const context = snapshot<TransitionContext>(suppliedContext);
    const capturedHistory = snapshot<readonly unknown[]>(history);
    const replayed = this.replay(command.aggregateId, capturedHistory);
    if (command.expectedVersion !== replayed.version) {
      throw new KernelError(
        "KERNEL_VERSION_CONFLICT",
        "Expected version differs from committed history",
      );
    }
    const decision = snapshot<EventDecision>(this.domain.decide(replayed.state, command));
    const schemaId = Object.hasOwn(this.domain.eventSchemas, decision.eventType)
      ? this.domain.eventSchemas[decision.eventType]
      : undefined;
    if (schemaId === undefined) {
      throw new KernelError("KERNEL_DOMAIN_REJECTED", "Domain proposed an unsupported event");
    }
    const event: DomainEventEnvelope = {
      schemaVersion: "1.0.0",
      eventId: context.eventId,
      eventType: decision.eventType,
      aggregateType: command.aggregateType,
      aggregateId: command.aggregateId,
      aggregateVersion: replayed.version + 1,
      occurredAt: context.occurredAt,
      actor: command.actor,
      causationId: command.commandId,
      correlationId: command.correlationId,
      payloadSchema: this.#schemaRef(schemaId),
      payloadHash: canonicalJsonSha256(decision.payload),
      payload: decision.payload,
    };
    // Use the same validation/reducer path as recovery before exposing a batch.
    const next = this.replay(command.aggregateId, [...capturedHistory, event]);
    if (next.state === null) {
      throw new KernelError("KERNEL_DOMAIN_REJECTED", "Transition did not produce aggregate state");
    }
    const identity = commandIdentity(command);
    const batch: JournalAppendBatch = {
      schemaVersion: "1.0.0",
      ...identity,
      transactionId: context.transactionId,
      capturedAt: context.occurredAt,
      stream: {
        aggregateType: command.aggregateType,
        aggregateId: command.aggregateId,
        expectedVersion: command.expectedVersion,
      },
      events: [event],
      outbox: [],
      audit: [
        {
          auditId: context.auditId,
          action: "KERNEL_COMMAND_COMMITTED",
          occurredAt: context.occurredAt,
          payloadHash: identity.payloadHash,
        },
      ],
    };
    this.#validate("urn:aseos:schema:journal-append-batch:1.0.0", batch);
    return freezeJson({ batch, state: next.state, events: batch.events });
  }
}
