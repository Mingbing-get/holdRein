import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus, AgentEventListener } from "./agent-event-bus";
import type { AgentRuntime } from "./agent-runtime";
import type {
  AgentEventSubscription,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  StartAgentInput,
  StartAgentResult,
  SubscribeAgentEventsInput
} from "./agent-types";

export interface AgentsService {
  approveAgentAction: (
    input: ApprovalDecisionInput
  ) => Promise<ApprovalDecisionResult>;
  startAgent: (input: StartAgentInput) => Promise<StartAgentResult>;
  subscribeToAgentEvents: (
    input: SubscribeAgentEventsInput,
    listener: AgentEventListener
  ) => AgentEventSubscription;
}

export interface CreateAgentsServiceOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  runtime: AgentRuntime;
}

export function createAgentsService(
  options: CreateAgentsServiceOptions
): AgentsService {
  return {
    approveAgentAction: async (input) => {
      if (!options.approvalStore.decide(input)) {
        throw new Error("Unknown approval request");
      }

      return input;
    },
    startAgent: (input) => options.runtime.start(input),
    subscribeToAgentEvents: (input, listener) =>
      options.eventBus.subscribe(input, listener)
  };
}
