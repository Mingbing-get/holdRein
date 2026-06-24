import { loadApiEnv } from "../../../config/env";
import { DB_FILE } from "../../../config/const";
import { createDatabase, migrateDatabase } from "../../../db";
import { createSqliteWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { getDefaultActiveTaskRunRegistry } from "../task/active-run-registry";
import { createAgentEventBus } from "../event/event-bus";
import type { AgentModelLookup } from "../model/resolver";
import { createAgentRuntime } from "../runtime";
import { createDefaultTaskTitleGenerator } from "../task/title-generator";
import { createAgentsService, type AgentsService } from ".";
import { toCustomAgentModel } from "../model/custom-model";
import { createSqliteSubagentRepository } from "../subagent/repository";
import { getDefaultModelProvidersService } from "../../model-providers";
import { getDefaultModelProxiesService } from "../../model-proxies";
import { recoverInterruptedAgentRuns } from "./startup-recovery";

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
    const modelProxiesService = getDefaultModelProxiesService();
    const getCustomModel = createCustomModelLookup(modelProvidersService);
    migrateDatabase(database.sqlite);
    const repository = createSqliteWorkspaceRepository(database);
    const subagentRepository = createSqliteSubagentRepository(database);
    recoverInterruptedAgentRuns({
      now: new Date().toISOString(),
      repository,
      subagentRepository
    });

    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      getApiKey: async (provider, modelId) =>
        modelProvidersService.getConfiguredModelForProvider(provider, modelId)
          ?.apiKey,
      getCustomModel,
      modelProxiesService,
      subagentDatabase: database,
      subagentRepository,
      tokenUsageStorageTarget: repository
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
