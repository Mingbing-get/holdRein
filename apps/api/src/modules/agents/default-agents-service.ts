import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import { createSqliteWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentRuntime } from "./agent-runtime";
import { createDefaultTaskTitleGenerator } from "./agent-task-title-generator";
import { createAgentsService, type AgentsService } from "./agents-service";
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
    const modelProvidersService = getDefaultModelProvidersService();
    migrateDatabase(database.sqlite);

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
      modelProvidersService,
      repository: createSqliteWorkspaceRepository(database),
      runtime,
      titleGenerator: createDefaultTaskTitleGenerator()
    });
  }

  return service;
}
