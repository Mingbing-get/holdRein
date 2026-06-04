import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { AppDatabase } from "../../db";
import {
  customModelProviders,
  customProviderModels,
  providerApiKeys,
  type CustomModelProviderRow,
  type CustomProviderModelRow,
  type ProviderApiKeyRow
} from "../../db";

export interface CreateCustomModelProviderInput {
  baseUrl: string;
  provider: string;
}

export interface CreateCustomProviderModelInput {
  api: string;
  contextWindow: number;
  input: string[];
  maxTokens: number;
  modelId: string;
  providerId: string;
  reasoning: boolean;
}

export interface SaveProviderApiKeyInput {
  apiKeyCiphertext: string;
  apiKeyIv: string;
  apiKeyTag: string;
  provider: string;
}

export interface ModelProviderRepository {
  createCustomModelProvider: (
    input: CreateCustomModelProviderInput
  ) => CustomModelProviderRow;
  createCustomProviderModel: (
    input: CreateCustomProviderModelInput
  ) => CustomProviderModelRow;
  findCustomModelProviderByProvider: (
    provider: string
  ) => CustomModelProviderRow | undefined;
  findProviderApiKeyByProvider: (provider: string) => ProviderApiKeyRow | undefined;
  listCustomModelProviders: () => CustomModelProviderRow[];
  listCustomProviderModelsByProviderId: (
    providerId: string
  ) => CustomProviderModelRow[];
  saveProviderApiKey: (input: SaveProviderApiKeyInput) => ProviderApiKeyRow;
}

export function createInMemoryModelProviderRepository(): ModelProviderRepository {
  const customProviders = new Map<string, CustomModelProviderRow>();
  const customModels = new Map<string, CustomProviderModelRow[]>();
  const apiKeys = new Map<string, ProviderApiKeyRow>();

  return {
    createCustomModelProvider: (input) => {
      const now = new Date().toISOString();
      const row: CustomModelProviderRow = {
        baseUrl: input.baseUrl,
        createdAt: now,
        id: randomUUID(),
        provider: input.provider,
        updatedAt: now
      };

      customProviders.set(row.provider, row);
      return row;
    },
    createCustomProviderModel: (input) => {
      const now = new Date().toISOString();
      const row: CustomProviderModelRow = {
        api: input.api,
        contextWindow: input.contextWindow,
        createdAt: now,
        id: randomUUID(),
        input: JSON.stringify(input.input),
        maxTokens: input.maxTokens,
        modelId: input.modelId,
        providerId: input.providerId,
        reasoning: input.reasoning,
        updatedAt: now
      };
      const rows = customModels.get(row.providerId) ?? [];

      rows.push(row);
      customModels.set(row.providerId, rows);
      return row;
    },
    findCustomModelProviderByProvider: (provider) => customProviders.get(provider),
    findProviderApiKeyByProvider: (provider) => apiKeys.get(provider),
    listCustomModelProviders: () => Array.from(customProviders.values()),
    listCustomProviderModelsByProviderId: (providerId) =>
      customModels.get(providerId) ?? [],
    saveProviderApiKey: (input) => {
      const existing = apiKeys.get(input.provider);
      const now = new Date().toISOString();
      const row: ProviderApiKeyRow = {
        apiKeyCiphertext: input.apiKeyCiphertext,
        apiKeyIv: input.apiKeyIv,
        apiKeyTag: input.apiKeyTag,
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? randomUUID(),
        provider: input.provider,
        updatedAt: now
      };

      apiKeys.set(row.provider, row);
      return row;
    }
  };
}

export function createSqliteModelProviderRepository(
  database: AppDatabase
): ModelProviderRepository {
  return {
    createCustomModelProvider: (input) => {
      const now = new Date().toISOString();
      const row: CustomModelProviderRow = {
        baseUrl: input.baseUrl,
        createdAt: now,
        id: randomUUID(),
        provider: input.provider,
        updatedAt: now
      };

      database.db.insert(customModelProviders).values(row).run();
      return row;
    },
    createCustomProviderModel: (input) => {
      const now = new Date().toISOString();
      const row: CustomProviderModelRow = {
        api: input.api,
        contextWindow: input.contextWindow,
        createdAt: now,
        id: randomUUID(),
        input: JSON.stringify(input.input),
        maxTokens: input.maxTokens,
        modelId: input.modelId,
        providerId: input.providerId,
        reasoning: input.reasoning,
        updatedAt: now
      };

      database.db.insert(customProviderModels).values(row).run();
      return row;
    },
    findCustomModelProviderByProvider: (provider) =>
      database.db
        .select()
        .from(customModelProviders)
        .where(eq(customModelProviders.provider, provider))
        .get(),
    findProviderApiKeyByProvider: (provider) =>
      database.db
        .select()
        .from(providerApiKeys)
        .where(eq(providerApiKeys.provider, provider))
        .get(),
    listCustomModelProviders: () =>
      database.db.select().from(customModelProviders).all(),
    listCustomProviderModelsByProviderId: (providerId) =>
      database.db
        .select()
        .from(customProviderModels)
        .where(eq(customProviderModels.providerId, providerId))
        .all(),
    saveProviderApiKey: (input) => {
      const existing = database.db
        .select()
        .from(providerApiKeys)
        .where(eq(providerApiKeys.provider, input.provider))
        .get();
      const now = new Date().toISOString();
      const row: ProviderApiKeyRow = {
        apiKeyCiphertext: input.apiKeyCiphertext,
        apiKeyIv: input.apiKeyIv,
        apiKeyTag: input.apiKeyTag,
        createdAt: existing?.createdAt ?? now,
        id: existing?.id ?? randomUUID(),
        provider: input.provider,
        updatedAt: now
      };

      if (existing) {
        database.db
          .update(providerApiKeys)
          .set(row)
          .where(eq(providerApiKeys.id, existing.id))
          .run();
      } else {
        database.db.insert(providerApiKeys).values(row).run();
      }

      return row;
    }
  };
}
