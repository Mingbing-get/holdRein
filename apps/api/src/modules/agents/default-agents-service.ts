import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentRuntime } from "./agent-runtime";
import { createAgentsService, type AgentsService } from "./agents-service";
import { getDefaultModelProvidersService } from "../model-providers";

let service: AgentsService | undefined;

export function getDefaultAgentsService(): AgentsService {
  if (!service) {
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const modelProvidersService = getDefaultModelProvidersService();
    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      getApiKey: async (provider, modelId) =>
        modelProvidersService.getConfiguredModelForProvider(provider, modelId)
          ?.apiKey
    });

    service = createAgentsService({
      approvalStore,
      eventBus,
      runtime
    });
  }

  return service;
}
