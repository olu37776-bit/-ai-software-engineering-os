import {
  canonicalJsonSha256,
  type CommandEnvelope,
  type ContractRegistry,
  type PersistenceCommitReceipt,
} from "@aseos/contracts";
import {
  commandIdentity,
  DeterministicKernel,
  KernelError,
  type ReplayResult,
} from "@aseos/kernel";
import { PersistenceError, type PersistenceWorker } from "@aseos/persistence";
import { workflowRunDefinition, type WorkflowRunState } from "@aseos/workflow";

import { createUuidV7 } from "./identity.js";

export type WorkflowPersistence = Pick<
  PersistenceWorker,
  "lookupCommandReceipt" | "readEvents" | "commit"
>;

export type WorkflowServiceOptions = Readonly<{
  registry: ContractRegistry;
  persistence: WorkflowPersistence;
  now?: () => string;
  createId?: () => string;
}>;

export type WorkflowCommandResult = Readonly<{
  state: WorkflowRunState;
  receipt: PersistenceCommitReceipt;
}>;

/** Internal application service; not an externally exposed or authorized command endpoint. */
export class WorkflowService {
  readonly #kernel: DeterministicKernel<WorkflowRunState>;
  readonly #persistence: WorkflowPersistence;
  readonly #now: () => string;
  readonly #createId: () => string;

  public constructor(options: WorkflowServiceOptions) {
    this.#kernel = new DeterministicKernel(options.registry, workflowRunDefinition);
    this.#persistence = options.persistence;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#createId = options.createId ?? createUuidV7;
  }

  public async replay(aggregateId: string): Promise<ReplayResult<WorkflowRunState>> {
    const events = await this.#persistence.readEvents("WorkflowRun", aggregateId);
    return this.#kernel.replay(aggregateId, events);
  }

  public async execute(input: unknown): Promise<WorkflowCommandResult> {
    // Admission captures a canonical snapshot before crossing the first asynchronous boundary.
    const command = this.#kernel.admitCommand(input);
    const identity = commandIdentity(command);
    const duplicate = await this.#persistence.lookupCommandReceipt(identity);
    if (duplicate !== null) return this.#result(command, duplicate);

    let receipt: PersistenceCommitReceipt;
    try {
      const history = await this.#persistence.readEvents(
        command.aggregateType,
        command.aggregateId,
      );
      const transition = this.#kernel.prepare(command, history, {
        eventId: this.#createId(),
        auditId: this.#createId(),
        transactionId: this.#createId(),
        occurredAt: this.#now(),
      });
      receipt = await this.#persistence.commit(transition.batch);
    } catch (error: unknown) {
      // Another service/worker may commit after the initial lookup. Only the durable
      // receipt can turn that race into success; no local cache authorizes a duplicate.
      if (
        (error instanceof KernelError && error.code === "KERNEL_VERSION_CONFLICT") ||
        (error instanceof PersistenceError && error.code === "PERSISTENCE_OPTIMISTIC_CONCURRENCY")
      ) {
        const racedReceipt = await this.#persistence.lookupCommandReceipt(identity);
        if (racedReceipt !== null) return this.#result(command, racedReceipt);
      }
      throw error;
    }
    return this.#result(command, receipt);
  }

  async #result(
    command: CommandEnvelope,
    receipt: PersistenceCommitReceipt,
  ): Promise<WorkflowCommandResult> {
    const { receiptHash, ...receiptBase } = receipt;
    if (
      receipt.commandId !== command.commandId ||
      receipt.aggregateType !== command.aggregateType ||
      receipt.aggregateId !== command.aggregateId ||
      receiptHash !== canonicalJsonSha256(receiptBase)
    ) {
      throw new KernelError(
        "KERNEL_REPLAY_INVALID",
        "Persisted receipt identity or hash is invalid",
      );
    }
    const events = await this.#persistence.readEvents(command.aggregateType, command.aggregateId);
    const committedEvents = events.filter(
      (event) =>
        event.aggregateVersion > command.expectedVersion &&
        event.aggregateVersion <= receipt.committedVersion,
    );
    if (
      canonicalJsonSha256(committedEvents.map((event) => event.eventId)) !==
        canonicalJsonSha256(receipt.eventIds) ||
      committedEvents.some((event) => event.causationId !== command.commandId)
    ) {
      throw new KernelError(
        "KERNEL_REPLAY_INVALID",
        "Persisted receipt does not bind its command events",
      );
    }
    const replayed = this.#kernel.replay(
      command.aggregateId,
      events.filter((event) => event.aggregateVersion <= receipt.committedVersion),
    );
    if (replayed.state === null || replayed.version !== receipt.committedVersion) {
      throw new KernelError(
        "KERNEL_REPLAY_INVALID",
        "Persisted receipt has no matching replay state",
      );
    }
    return { state: replayed.state, receipt };
  }
}
