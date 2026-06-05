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
  name: string;
  providerId: string;
  reasoning: boolean;
}

export interface UpdateCustomModelProviderInput {
  baseUrl: string;
  provider: string;
}

export interface UpdateCustomProviderModelInput {
  api: string;
  contextWindow: number;
  input: string[];
  maxTokens: number;
  name: string;
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
  deleteCustomModelProvider: (provider: string) => boolean;
  deleteCustomProviderModel: (providerId: string, modelId: string) => boolean;
  findCustomModelProviderByProvider: (
    provider: string
  ) => CustomModelProviderRow | undefined;
  findCustomProviderModel: (
    providerId: string,
    modelId: string
  ) => CustomProviderModelRow | undefined;
  findProviderApiKeyByProvider: (provider: string) => ProviderApiKeyRow | undefined;
  listCustomModelProviders: () => CustomModelProviderRow[];
  listCustomProviderModelsByProviderId: (
    providerId: string
  ) => CustomProviderModelRow[];
  saveProviderApiKey: (input: SaveProviderApiKeyInput) => ProviderApiKeyRow;
  updateCustomModelProvider: (
    provider: string,
    input: UpdateCustomModelProviderInput
  ) => CustomModelProviderRow | undefined;
  updateCustomProviderModel: (
    providerId: string,
    modelId: string,
    input: UpdateCustomProviderModelInput
  ) => CustomProviderModelRow | undefined;
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
        name: input.name,
        providerId: input.providerId,
        reasoning: input.reasoning,
        updatedAt: now
      };
      const rows = customModels.get(row.providerId) ?? [];

      rows.push(row);
      customModels.set(row.providerId, rows);
      return row;
    },
    deleteCustomModelProvider: (provider) => {
      const existing = customProviders.get(provider);

      if (!existing) {
        return false;
      }

      customProviders.delete(provider);
      customModels.delete(existing.id);
      apiKeys.delete(provider);
      return true;
    },
    deleteCustomProviderModel: (providerId, modelId) => {
      const rows = customModels.get(providerId) ?? [];
      const nextRows = rows.filter((model) => model.modelId !== modelId);

      if (nextRows.length === rows.length) {
        return false;
      }

      customModels.set(providerId, nextRows);
      return true;
    },
    findCustomModelProviderByProvider: (provider) => customProviders.get(provider),
    findCustomProviderModel: (providerId, modelId) =>
      (customModels.get(providerId) ?? []).find((model) => model.modelId === modelId),
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
    },
    updateCustomModelProvider: (provider, input) => {
      const existing = customProviders.get(provider);

      if (!existing) {
        return undefined;
      }

      const row: CustomModelProviderRow = {
        ...existing,
        baseUrl: input.baseUrl,
        provider: input.provider,
        updatedAt: new Date().toISOString()
      };

      customProviders.delete(provider);
      customProviders.set(row.provider, row);

      const existingApiKey = apiKeys.get(provider);

      if (existingApiKey) {
        apiKeys.delete(provider);
        apiKeys.set(row.provider, {
          ...existingApiKey,
          provider: row.provider,
          updatedAt: row.updatedAt
        });
      }

      return row;
    },
    updateCustomProviderModel: (providerId, modelId, input) => {
      const rows = customModels.get(providerId) ?? [];
      const index = rows.findIndex((model) => model.modelId === modelId);
      const existingRow = rows[index];

      if (index === -1 || !existingRow) {
        return undefined;
      }

      const row: CustomProviderModelRow = {
        ...existingRow,
        api: input.api,
        contextWindow: input.contextWindow,
        input: JSON.stringify(input.input),
        maxTokens: input.maxTokens,
        name: input.name,
        reasoning: input.reasoning,
        updatedAt: new Date().toISOString()
      };

      rows[index] = row;
      customModels.set(providerId, rows);
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
        name: input.name,
        providerId: input.providerId,
        reasoning: input.reasoning,
        updatedAt: now
      };

      database.db.insert(customProviderModels).values(row).run();
      return row;
    },
    deleteCustomModelProvider: (provider) => {
      const existing = database.db
        .select()
        .from(customModelProviders)
        .where(eq(customModelProviders.provider, provider))
        .get();

      if (!existing) {
        return false;
      }

      database.db
        .delete(customProviderModels)
        .where(eq(customProviderModels.providerId, existing.id))
        .run();
      database.db
        .delete(providerApiKeys)
        .where(eq(providerApiKeys.provider, provider))
        .run();
      database.db
        .delete(customModelProviders)
        .where(eq(customModelProviders.id, existing.id))
        .run();
      return true;
    },
    deleteCustomProviderModel: (providerId, modelId) => {
      const existing = database.db
        .select()
        .from(customProviderModels)
        .where(eq(customProviderModels.providerId, providerId))
        .all()
        .find((model) => model.modelId === modelId);

      if (!existing) {
        return false;
      }

      database.db
        .delete(customProviderModels)
        .where(eq(customProviderModels.id, existing.id))
        .run();

      return true;
    },
    findCustomModelProviderByProvider: (provider) =>
      database.db
        .select()
        .from(customModelProviders)
        .where(eq(customModelProviders.provider, provider))
        .get(),
    findCustomProviderModel: (providerId, modelId) =>
      database.db
        .select()
        .from(customProviderModels)
        .where(eq(customProviderModels.providerId, providerId))
        .all()
        .find((model) => model.modelId === modelId),
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
    },
    updateCustomModelProvider: (provider, input) => {
      const existing = database.db
        .select()
        .from(customModelProviders)
        .where(eq(customModelProviders.provider, provider))
        .get();

      if (!existing) {
        return undefined;
      }

      const row: CustomModelProviderRow = {
        ...existing,
        baseUrl: input.baseUrl,
        provider: input.provider,
        updatedAt: new Date().toISOString()
      };

      database.db
        .update(customModelProviders)
        .set(row)
        .where(eq(customModelProviders.id, existing.id))
        .run();

      const existingApiKey = database.db
        .select()
        .from(providerApiKeys)
        .where(eq(providerApiKeys.provider, provider))
        .get();

      if (existingApiKey) {
        database.db
          .update(providerApiKeys)
          .set({
            ...existingApiKey,
            provider: row.provider,
            updatedAt: row.updatedAt
          })
          .where(eq(providerApiKeys.id, existingApiKey.id))
          .run();
      }

      return row;
    },
    updateCustomProviderModel: (providerId, modelId, input) => {
      const existing = database.db
        .select()
        .from(customProviderModels)
        .where(eq(customProviderModels.providerId, providerId))
        .all()
        .find((model) => model.modelId === modelId);

      if (!existing) {
        return undefined;
      }

      const row: CustomProviderModelRow = {
        ...existing,
        api: input.api,
        contextWindow: input.contextWindow,
        input: JSON.stringify(input.input),
        maxTokens: input.maxTokens,
        name: input.name,
        reasoning: input.reasoning,
        updatedAt: new Date().toISOString()
      };

      database.db
        .update(customProviderModels)
        .set(row)
        .where(eq(customProviderModels.id, existing.id))
        .run();

      return row;
    }
  };
}
