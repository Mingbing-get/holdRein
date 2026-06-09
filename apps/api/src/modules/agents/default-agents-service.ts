import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import { createSqliteWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createSqliteAgentMessageRepository } from "./agent-message-repository";
import type { AgentModelLookup } from "./agent-model-resolver";
import { createAgentRuntime } from "./agent-runtime";
import { createDefaultTaskTitleGenerator } from "./agent-task-title-generator";
import { createAgentsService, type AgentsService } from "./agents-service";
import { toCustomAgentModel } from "./custom-agent-model";
import { getDefaultModelProvidersService } from "../model-providers";

let service: AgentsService | undefined;

export function getDefaultAgentsService(): AgentsService {
  if (!service) {
    loadApiEnv();

    const database = createDatabase(
      process.env.SQLITE_DB_PATH ?? "./data/hold-rein.sqlite"
    );
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const messageRepository = createSqliteAgentMessageRepository(database);
    const modelProvidersService = getDefaultModelProvidersService();
    const getCustomModel = createCustomModelLookup(modelProvidersService);
    migrateDatabase(database.sqlite);

    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      messageRepository,
      getApiKey: async (provider, modelId) =>
        modelProvidersService.getConfiguredModelForProvider(provider, modelId)
          ?.apiKey,
      getCustomModel
    });

    service = createAgentsService({
      approvalStore,
      eventBus,
      messageRepository,
      modelProvidersService,
      repository: createSqliteWorkspaceRepository(database),
      runtime,
      titleGenerator: createDefaultTaskTitleGenerator({ getCustomModel })
    });
  }

  return service;
}

function createCustomModelLookup(
  modelProvidersService: ReturnType<typeof getDefaultModelProvidersService>
): AgentModelLookup {
  return (provider, modelId) => {
    const configuredModel =
      modelProvidersService.getConfiguredModelForProvider(provider, modelId);

    return configuredModel ? toCustomAgentModel(configuredModel) : null;
  };
}
