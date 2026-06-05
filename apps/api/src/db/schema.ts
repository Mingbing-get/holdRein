import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customModelProviders = sqliteTable(
  "custom_model_providers",
  {
    baseUrl: text("base_url").notNull(),
    createdAt: text("created_at").notNull(),
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    providerUniqueIndex: uniqueIndex("custom_model_providers_provider_idx").on(
      table.provider
    )
  })
);

export const providerApiKeys = sqliteTable(
  "provider_api_keys",
  {
    apiKeyCiphertext: text("api_key_ciphertext").notNull(),
    apiKeyIv: text("api_key_iv").notNull(),
    apiKeyTag: text("api_key_tag").notNull(),
    createdAt: text("created_at").notNull(),
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    providerUniqueIndex: uniqueIndex("provider_api_keys_provider_idx").on(
      table.provider
    )
  })
);

export const customProviderModels = sqliteTable(
  "custom_provider_models",
  {
    api: text("api").notNull(),
    contextWindow: integer("context_window").notNull(),
    createdAt: text("created_at").notNull(),
    id: text("id").primaryKey(),
    input: text("input").notNull(),
    maxTokens: integer("max_tokens").notNull(),
    modelId: text("model_id").notNull(),
    name: text("name").notNull(),
    providerId: text("provider_id")
      .notNull()
      .references(() => customModelProviders.id),
    reasoning: integer("reasoning", { mode: "boolean" }).notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    providerModelUniqueIndex: uniqueIndex("custom_provider_models_provider_model_idx").on(
      table.providerId,
      table.modelId
    )
  })
);

export type CustomModelProviderRow = typeof customModelProviders.$inferSelect;
export type NewCustomModelProviderRow = typeof customModelProviders.$inferInsert;
export type ProviderApiKeyRow = typeof providerApiKeys.$inferSelect;
export type NewProviderApiKeyRow = typeof providerApiKeys.$inferInsert;
export type CustomProviderModelRow = typeof customProviderModels.$inferSelect;
export type NewCustomProviderModelRow = typeof customProviderModels.$inferInsert;
