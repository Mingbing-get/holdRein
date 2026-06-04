const CREATE_CUSTOM_MODEL_PROVIDERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS custom_model_providers (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    base_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT
`;

const CREATE_CUSTOM_MODEL_PROVIDERS_PROVIDER_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS custom_model_providers_provider_idx
  ON custom_model_providers (provider)
`;

const CREATE_PROVIDER_API_KEYS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS provider_api_keys (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL,
    api_key_ciphertext TEXT NOT NULL,
    api_key_iv TEXT NOT NULL,
    api_key_tag TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT
`;

const CREATE_PROVIDER_API_KEYS_PROVIDER_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS provider_api_keys_provider_idx
  ON provider_api_keys (provider)
`;

const CREATE_CUSTOM_PROVIDER_MODELS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS custom_provider_models (
    id TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    api TEXT NOT NULL,
    reasoning INTEGER NOT NULL CHECK(reasoning IN (0, 1)),
    input TEXT NOT NULL,
    context_window INTEGER NOT NULL,
    max_tokens INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (provider_id) REFERENCES custom_model_providers(id)
  ) STRICT
`;

const CREATE_CUSTOM_PROVIDER_MODELS_PROVIDER_MODEL_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS custom_provider_models_provider_model_idx
  ON custom_provider_models (provider_id, model_id)
`;

export function migrateDatabase(sqlite: { exec: (sql: string) => void }): void {
  sqlite.exec(CREATE_CUSTOM_MODEL_PROVIDERS_TABLE_SQL);
  sqlite.exec(CREATE_CUSTOM_MODEL_PROVIDERS_PROVIDER_INDEX_SQL);
  sqlite.exec(CREATE_PROVIDER_API_KEYS_TABLE_SQL);
  sqlite.exec(CREATE_PROVIDER_API_KEYS_PROVIDER_INDEX_SQL);
  sqlite.exec(CREATE_CUSTOM_PROVIDER_MODELS_TABLE_SQL);
  sqlite.exec(CREATE_CUSTOM_PROVIDER_MODELS_PROVIDER_MODEL_INDEX_SQL);
}
