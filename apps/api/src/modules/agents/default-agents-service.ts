import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import type { Api, Model } from "@earendil-works/pi-ai";
import { createSqliteWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import type { AgentModelLookup } from "./agent-model-resolver";
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
    const getCustomModel = createCustomModelLookup(modelProvidersService);
    migrateDatabase(database.sqlite);

    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      getApiKey: async (provider, modelId) =>
        modelProvidersService.getConfiguredModelForProvider(provider, modelId)
          ?.apiKey,
      getCustomModel
    });

    service = createAgentsService({
      approvalStore,
      eventBus,
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

    return configuredModel ? toAgentModel(configuredModel) : null;
  };
}

function toAgentModel(configured: {
  baseUrl: string;
  model: {
    api: string;
    contextWindow: number;
    id: string;
    input: string[];
    maxTokens: number;
    name: string;
    provider: string;
    reasoning: boolean;
  };
}): Model<Api> {
  return {
    ...configured.model,
    api: configured.model.api as Api,
    baseUrl: configured.baseUrl,
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0
    },
    input: configured.model.input.filter(
      (input): input is "text" | "image" => input === "text" || input === "image"
    )
  };
}
