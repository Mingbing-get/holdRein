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
    name TEXT NOT NULL,
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

const ADD_CUSTOM_PROVIDER_MODELS_NAME_COLUMN_SQL = `
  ALTER TABLE custom_provider_models ADD COLUMN name TEXT NOT NULL DEFAULT ''
`;

const CREATE_WORKSPACES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT
`;

const CREATE_WORKSPACES_PATH_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS workspaces_path_idx
  ON workspaces (path)
`;

const CREATE_TASKS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    initial_user_message TEXT NOT NULL,
    last_model_provider_source TEXT NOT NULL CHECK(last_model_provider_source IN ('built_in', 'custom')),
    last_model_provider TEXT NOT NULL,
    last_model_id TEXT,
    last_model_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_continued_at TEXT,
    session_id TEXT,
    session_path TEXT,
    session_created_at TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('running', 'completed', 'error')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ) STRICT
`;

const CREATE_TASKS_WORKSPACE_ID_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx
  ON tasks (workspace_id)
`;

const ADD_TASKS_LAST_MODEL_ID_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN last_model_id TEXT
`;

const ADD_TASKS_SESSION_ID_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN session_id TEXT
`;

const ADD_TASKS_SESSION_PATH_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN session_path TEXT
`;

const ADD_TASKS_SESSION_CREATED_AT_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN session_created_at TEXT
`;

const ADD_TASKS_STATUS_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('running', 'completed', 'error'))
`;

const DROP_TASK_MESSAGES_TABLE_SQL = `
  DROP TABLE IF EXISTS task_messages
`;

export function migrateDatabase(sqlite: { exec: (sql: string) => void }): void {
  sqlite.exec(CREATE_CUSTOM_MODEL_PROVIDERS_TABLE_SQL);
  sqlite.exec(CREATE_CUSTOM_MODEL_PROVIDERS_PROVIDER_INDEX_SQL);
  sqlite.exec(CREATE_PROVIDER_API_KEYS_TABLE_SQL);
  sqlite.exec(CREATE_PROVIDER_API_KEYS_PROVIDER_INDEX_SQL);
  sqlite.exec(CREATE_CUSTOM_PROVIDER_MODELS_TABLE_SQL);
  try {
    sqlite.exec(ADD_CUSTOM_PROVIDER_MODELS_NAME_COLUMN_SQL);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }
  sqlite.exec(CREATE_CUSTOM_PROVIDER_MODELS_PROVIDER_MODEL_INDEX_SQL);
  sqlite.exec(CREATE_WORKSPACES_TABLE_SQL);
  sqlite.exec(CREATE_WORKSPACES_PATH_INDEX_SQL);
  sqlite.exec(CREATE_TASKS_TABLE_SQL);
  sqlite.exec(CREATE_TASKS_WORKSPACE_ID_INDEX_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_LAST_MODEL_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_PATH_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_CREATED_AT_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_STATUS_COLUMN_SQL);
  sqlite.exec(DROP_TASK_MESSAGES_TABLE_SQL);
}

function addColumnIfMissing(
  sqlite: { exec: (sql: string) => void },
  sql: string
): void {
  try {
    sqlite.exec(sql);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("duplicate column name")) {
      throw error;
    }
  }
}
