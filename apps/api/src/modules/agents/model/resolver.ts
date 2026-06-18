import {
  getModels,
  type Api,
  type KnownProvider,
  type Model
} from "@earendil-works/pi-ai";

export type AgentModelLookup = (
  provider: string,
  modelId: string
) => Model<Api> | null | Promise<Model<Api> | null>;

export async function resolveAgentModel(
  provider: string,
  modelId: string,
  getCustomModel?: AgentModelLookup
): Promise<Model<Api> | null> {
  const builtInModel = findBuiltInModel(provider, modelId);

  if (builtInModel) {
    return builtInModel;
  }

  return (await getCustomModel?.(provider, modelId)) ?? null;
}

function findBuiltInModel(provider: string, modelId: string): Model<Api> | null {
  try {
    return (
      getModels(provider as KnownProvider).find((model) => model.id === modelId) ??
      null
    );
  } catch {
    return null;
  }
}
