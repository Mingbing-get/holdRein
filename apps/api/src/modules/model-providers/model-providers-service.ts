import { getModels, getProviders, type KnownProvider } from "@earendil-works/pi-ai";
import type { getModel } from "@earendil-works/pi-ai";

import {
  decryptProviderApiKey,
  encryptProviderApiKey
} from "./model-provider-api-key-crypto";
import type { ModelProviderRepository } from "./model-provider-repository";

export interface ModelProviderSummary {
  hasApiKey: boolean;
  id: string;
  modelCount: number;
  source: "builtin" | "custom";
}

export interface CustomModelProviderSummary {
  baseUrl: string;
  createdAt: string;
  id: string;
  provider: string;
  updatedAt: string;
}

export interface ModelSummary {
  api: string;
  contextWindow: number;
  id: string;
  input: string[];
  maxTokens: number;
  name: string;
  provider: string;
  reasoning: boolean;
}

export interface ModelProvidersServiceOptions {
  providerApiKeyEncryptionKey: string;
  repository: ModelProviderRepository;
}

export interface ModelProvidersService {
  createCustomModelProvider: (
    provider: string,
    baseUrl: string
  ) => CustomModelProviderSummary;
  createCustomProviderModel: (
    provider: string,
    input: Omit<ModelSummary, "id" | "name" | "provider"> & { modelId: string }
  ) => ModelSummary;
  getConfiguredModelForProvider: (
    provider: string,
    modelId: string
  ) => {
    apiKey?: string;
    model: ModelSummary;
  } | null;
  hasProvider: (provider: string) => boolean;
  listModelsForProvider: (provider: string) => ModelSummary[];
  listModelProviders: () => ModelProviderSummary[];
  storeProviderApiKey: (provider: string, apiKey: string) => ModelProviderSummary;
  updateCustomModelProvider: (
    provider: string,
    nextProvider: string,
    baseUrl: string
  ) => CustomModelProviderSummary | null;
  updateCustomProviderModel: (
    provider: string,
    modelId: string,
    input: Omit<ModelSummary, "id" | "name" | "provider">
  ) => ModelSummary | null;
}

export function createModelProvidersService(
  options: ModelProvidersServiceOptions
): ModelProvidersService {
  const { providerApiKeyEncryptionKey, repository } = options;
  const listModelsForProvider = (provider: string): ModelSummary[] => {
    if (hasBuiltInProvider(provider)) {
      return getModels(provider).map(mapBuiltInModel);
    }

    const customProvider = repository.findCustomModelProviderByProvider(provider);

    if (!customProvider) {
      return [];
    }

    return repository
      .listCustomProviderModelsByProviderId(customProvider.id)
      .map((model) => ({
        api: model.api,
        contextWindow: model.contextWindow,
        id: model.modelId,
        input: JSON.parse(model.input) as string[],
        maxTokens: model.maxTokens,
        name: model.modelId,
        provider: customProvider.provider,
        reasoning: model.reasoning
      }));
  };

  return {
    createCustomModelProvider: (provider, baseUrl) => {
      const normalizedProvider = provider.trim();
      const normalizedBaseUrl = baseUrl.trim();

      if (hasBuiltInProvider(normalizedProvider)) {
        throw new Error("Provider conflicts with built-in provider");
      }

      if (hasCustomProvider(normalizedProvider, repository)) {
        throw new Error("Provider already exists");
      }

      return repository.createCustomModelProvider({
        baseUrl: normalizedBaseUrl,
        provider: normalizedProvider
      });
    },
    createCustomProviderModel: (provider, input) => {
      const customProvider = repository.findCustomModelProviderByProvider(provider);

      if (!customProvider) {
        throw new Error("Unknown custom provider");
      }

      const row = repository.createCustomProviderModel({
        api: input.api,
        contextWindow: input.contextWindow,
        input: input.input,
        maxTokens: input.maxTokens,
        modelId: input.modelId.trim(),
        providerId: customProvider.id,
        reasoning: input.reasoning
      });

      return mapCustomProviderModel(customProvider.provider, row);
    },
    getConfiguredModelForProvider: (provider, modelId) => {
      const model = findModel(provider, modelId, repository);

      if (!model) {
        return null;
      }

      const encryptedApiKey = repository.findProviderApiKeyByProvider(provider);

      return {
        ...(encryptedApiKey
          ? {
              apiKey: decryptProviderApiKey(
                {
                  ciphertext: encryptedApiKey.apiKeyCiphertext,
                  iv: encryptedApiKey.apiKeyIv,
                  tag: encryptedApiKey.apiKeyTag
                },
                providerApiKeyEncryptionKey
              )
            }
          : {}),
        model
      };
    },
    hasProvider: (provider) => hasBuiltInProvider(provider) || hasCustomProvider(provider, repository),
    listModelsForProvider,
    listModelProviders: () => {
      const builtInProviders = getProviders().map((provider) => ({
        hasApiKey: repository.findProviderApiKeyByProvider(provider) !== undefined,
        id: provider,
        modelCount: getModels(provider).length,
        source: "builtin" as const
      }));
      const customProviders = repository.listCustomModelProviders().map((provider) => ({
        hasApiKey:
          repository.findProviderApiKeyByProvider(provider.provider) !== undefined,
        id: provider.provider,
        modelCount: repository.listCustomProviderModelsByProviderId(provider.id).length,
        source: "custom" as const
      }));

      return [...builtInProviders, ...customProviders];
    },
    storeProviderApiKey: (provider, apiKey) => {
      if (!hasBuiltInProvider(provider) && !hasCustomProvider(provider, repository)) {
        throw new Error("Unknown provider");
      }

      const encryptedApiKey = encryptProviderApiKey(
        apiKey.trim(),
        providerApiKeyEncryptionKey
      );

      repository.saveProviderApiKey({
        apiKeyCiphertext: encryptedApiKey.ciphertext,
        apiKeyIv: encryptedApiKey.iv,
        apiKeyTag: encryptedApiKey.tag,
        provider
      });

      return {
        hasApiKey: true,
        id: provider,
        modelCount: listModelsForProvider(provider).length,
        source: hasBuiltInProvider(provider) ? "builtin" : "custom"
      };
    },
    updateCustomModelProvider: (provider, nextProvider, baseUrl) => {
      const normalizedProvider = nextProvider.trim();
      const normalizedBaseUrl = baseUrl.trim();

      if (
        normalizedProvider !== provider &&
        hasBuiltInProvider(normalizedProvider)
      ) {
        throw new Error("Provider conflicts with built-in provider");
      }

      const existingWithNextProvider =
        normalizedProvider === provider
          ? undefined
          : repository.findCustomModelProviderByProvider(normalizedProvider);

      if (existingWithNextProvider) {
        throw new Error("Provider already exists");
      }

      return (
        repository.updateCustomModelProvider(provider, {
          baseUrl: normalizedBaseUrl,
          provider: normalizedProvider
        }) ?? null
      );
    },
    updateCustomProviderModel: (provider, modelId, input) => {
      const customProvider = repository.findCustomModelProviderByProvider(provider);

      if (!customProvider) {
        return null;
      }

      const row = repository.updateCustomProviderModel(customProvider.id, modelId, {
        api: input.api,
        contextWindow: input.contextWindow,
        input: input.input,
        maxTokens: input.maxTokens,
        reasoning: input.reasoning
      });

      return row ? mapCustomProviderModel(customProvider.provider, row) : null;
    }
  };
}

function findModel(
  provider: string,
  modelId: string,
  repository: ModelProviderRepository
): ModelSummary | null {
  if (hasBuiltInProvider(provider)) {
    const model = getModels(provider).find((item) => item.id === modelId);

    return model ? mapBuiltInModel(model) : null;
  }

  const customProvider = repository.findCustomModelProviderByProvider(provider);

  if (!customProvider) {
    return null;
  }

  const model = repository
    .listCustomProviderModelsByProviderId(customProvider.id)
    .find((item) => item.modelId === modelId);

  if (!model) {
    return null;
  }

  return {
    ...mapCustomProviderModel(customProvider.provider, model)
  };
}

function hasBuiltInProvider(provider: string): provider is KnownProvider {
  return getProviders().includes(provider as KnownProvider);
}

function hasCustomProvider(
  provider: string,
  repository: ModelProviderRepository
): boolean {
  return repository.findCustomModelProviderByProvider(provider) !== undefined;
}

function mapBuiltInModel(
  model: ReturnType<typeof getModel<KnownProvider, never>>
): ModelSummary {
  return {
    api: model.api,
    contextWindow: model.contextWindow,
    id: model.id,
    input: [...model.input],
    maxTokens: model.maxTokens,
    name: model.name,
    provider: model.provider,
    reasoning: model.reasoning
  };
}

function mapCustomProviderModel(
  provider: string,
  model: {
    api: string;
    contextWindow: number;
    input: string;
    maxTokens: number;
    modelId: string;
    reasoning: boolean;
  }
): ModelSummary {
  return {
    api: model.api,
    contextWindow: model.contextWindow,
    id: model.modelId,
    input: JSON.parse(model.input) as string[],
    maxTokens: model.maxTokens,
    name: model.modelId,
    provider,
    reasoning: model.reasoning
  };
}
