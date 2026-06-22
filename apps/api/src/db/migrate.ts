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
    approval_policy TEXT NOT NULL DEFAULT 'approval' CHECK(approval_policy IN ('approval', 'run_all')),
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
    thinking_level TEXT NOT NULL DEFAULT 'medium' CHECK(thinking_level IN ('off', 'minimal', 'low', 'medium', 'high', 'xhigh')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ) STRICT
`;

const CREATE_TASKS_WORKSPACE_ID_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx
  ON tasks (workspace_id)
`;

const CREATE_SUBAGENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS subagents (
    agent_id TEXT PRIMARY KEY NOT NULL,
    agent_name TEXT NOT NULL DEFAULT 'subagent',
    parent_agent_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'interrupted')),
    session_id TEXT,
    session_path TEXT,
    session_created_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  ) STRICT
`;

const CREATE_SUBAGENTS_TASK_ID_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS subagents_task_id_idx
  ON subagents (task_id)
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

const ADD_TASKS_APPROVAL_POLICY_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN approval_policy TEXT NOT NULL DEFAULT 'approval' CHECK(approval_policy IN ('approval', 'run_all'))
`;

const ADD_TASKS_THINKING_LEVEL_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN thinking_level TEXT NOT NULL DEFAULT 'medium' CHECK(thinking_level IN ('off', 'minimal', 'low', 'medium', 'high', 'xhigh'))
`;

const ADD_SUBAGENTS_SESSION_ID_COLUMN_SQL = `
  ALTER TABLE subagents ADD COLUMN session_id TEXT
`;

const ADD_SUBAGENTS_AGENT_NAME_COLUMN_SQL = `
  ALTER TABLE subagents ADD COLUMN agent_name TEXT NOT NULL DEFAULT 'subagent'
`;

const ADD_SUBAGENTS_SESSION_PATH_COLUMN_SQL = `
  ALTER TABLE subagents ADD COLUMN session_path TEXT
`;

const ADD_SUBAGENTS_SESSION_CREATED_AT_COLUMN_SQL = `
  ALTER TABLE subagents ADD COLUMN session_created_at TEXT
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
  sqlite.exec(CREATE_SUBAGENTS_TABLE_SQL);
  sqlite.exec(CREATE_SUBAGENTS_TASK_ID_INDEX_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_LAST_MODEL_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_PATH_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_CREATED_AT_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_STATUS_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_APPROVAL_POLICY_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_THINKING_LEVEL_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_SUBAGENTS_AGENT_NAME_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_SUBAGENTS_SESSION_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_SUBAGENTS_SESSION_PATH_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_SUBAGENTS_SESSION_CREATED_AT_COLUMN_SQL);
  relaxSubagentStatusConstraint(sqlite);
  sqlite.exec(DROP_TASK_MESSAGES_TABLE_SQL);
}

function relaxSubagentStatusConstraint(sqlite: {
  exec: (sql: string) => void;
  prepare?: (sql: string) => {
    get: () => { sql?: string | null } | undefined;
  };
}): void {
  const createTableSql = sqlite
    .prepare?.("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'subagents'")
    .get()?.sql;

  if (
    typeof createTableSql !== "string" ||
    !createTableSql.includes("CHECK(status IN ('running', 'completed'))")
  ) {
    return;
  }

  sqlite.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE subagents_new (
      agent_id TEXT PRIMARY KEY NOT NULL,
      agent_name TEXT NOT NULL DEFAULT 'subagent',
      parent_agent_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'interrupted')),
      session_id TEXT,
      session_path TEXT,
      session_created_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    ) STRICT;
    INSERT INTO subagents_new (
      agent_id, parent_agent_id, task_id, status,
      agent_name,
      session_id, session_path, session_created_at,
      created_at, updated_at
    )
    SELECT
      agent_id, parent_agent_id, task_id, status,
      agent_name,
      session_id, session_path, session_created_at,
      created_at, updated_at
    FROM subagents;
    DROP TABLE subagents;
    ALTER TABLE subagents_new RENAME TO subagents;
    CREATE INDEX IF NOT EXISTS subagents_task_id_idx
    ON subagents (task_id);
    PRAGMA foreign_keys=ON;
  `);
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
