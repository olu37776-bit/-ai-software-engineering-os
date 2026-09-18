import type {
  CommandEnvelope,
  CreateWorkflowRunPayload,
  DomainEventEnvelope,
  WorkflowRunCreatedPayload,
} from "@aseos/contracts";
import { KernelError, type AggregateDefinition, type EventDecision } from "@aseos/kernel";

/** First-slice state contains only facts recoverable from the canonical event. */
export type WorkflowRunState = Readonly<{
  runId: string;
  version: number;
  status: "CREATED";
  workflowDefinitionId: string;
  workflowDefinitionVersion: string;
  createdByCommandId: string;
  createdAt: string;
}>;

function decide(state: WorkflowRunState | null, command: CommandEnvelope): EventDecision {
  if (
    state !== null ||
    command.commandType !== "CreateWorkflowRun" ||
    command.expectedVersion !== 0
  ) {
    throw new KernelError("KERNEL_DOMAIN_REJECTED", "Workflow run can only be created once");
  }
  const payload = command.payload as CreateWorkflowRunPayload;
  return {
    eventType: "WorkflowRunCreated",
    payload: {
      workflowDefinitionId: payload.workflowDefinitionId,
      workflowDefinitionVersion: payload.workflowDefinitionVersion,
      createdByCommandId: command.commandId,
    },
  };
}

function apply(state: WorkflowRunState | null, event: DomainEventEnvelope): WorkflowRunState {
  const payload = event.payload as WorkflowRunCreatedPayload;
  if (
    state !== null ||
    event.eventType !== "WorkflowRunCreated" ||
    event.aggregateVersion !== 1 ||
    payload.createdByCommandId !== event.causationId
  ) {
    throw new KernelError("KERNEL_REPLAY_INVALID", "Invalid workflow creation or causation");
  }
  return {
    runId: event.aggregateId,
    version: event.aggregateVersion,
    status: "CREATED",
    workflowDefinitionId: payload.workflowDefinitionId,
    workflowDefinitionVersion: payload.workflowDefinitionVersion,
    createdByCommandId: payload.createdByCommandId,
    createdAt: event.occurredAt,
  };
}

export const workflowRunDefinition: AggregateDefinition<WorkflowRunState> = Object.freeze({
  aggregateType: "WorkflowRun",
  commandSchemas: Object.freeze({
    CreateWorkflowRun: "urn:aseos:schema:create-workflow-run-payload:1.0.0",
  }),
  eventSchemas: Object.freeze({
    WorkflowRunCreated: "urn:aseos:schema:workflow-run-created-payload:1.0.0",
  }),
  decide,
  apply,
});
