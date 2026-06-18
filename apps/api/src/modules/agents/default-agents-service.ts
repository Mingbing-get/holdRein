import { loadApiEnv } from "../../config/env";
import { DB_FILE } from "../../config/const";
import { createDatabase, migrateDatabase } from "../../db";
import { createSqliteWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { getDefaultActiveTaskRunRegistry } from "./active-task-run-registry";
import { createAgentEventBus } from "./agent-event-bus";
import type { AgentModelLookup } from "./agent-model-resolver";
import { createAgentRuntime } from "./agent-runtime";
import { createDefaultTaskTitleGenerator } from "./agent-task-title-generator";
import { createAgentsService, type AgentsService } from "./agents-service";
import { toCustomAgentModel } from "./custom-agent-model";
import { createSqliteSubagentRepository } from "./subagent-repository";
import { getDefaultModelProvidersService } from "../model-providers";

let service: AgentsService | undefined;

export function getDefaultAgentsService(): AgentsService {
  if (!service) {
    loadApiEnv();

    const database = createDatabase(
      process.env.SQLITE_DB_PATH ?? DB_FILE
    );
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const modelProvidersService = getDefaultModelProvidersService();
    const getCustomModel = createCustomModelLookup(modelProvidersService);
    migrateDatabase(database.sqlite);
    const repository = createSqliteWorkspaceRepository(database);
    const subagentRepository = createSqliteSubagentRepository(database);

    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      getApiKey: async (provider, modelId) =>
        modelProvidersService.getConfiguredModelForProvider(provider, modelId)
          ?.apiKey,
      getCustomModel,
      subagentRepository
    });

    service = createAgentsService({
      activeTaskRuns: getDefaultActiveTaskRunRegistry(),
      approvalStore,
      eventBus,
      modelProvidersService,
      repository,
      runtime,
      subagentRepository,
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
