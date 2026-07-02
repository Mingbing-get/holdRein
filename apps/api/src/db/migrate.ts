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

const CREATE_MODEL_PROXIES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS model_proxies (
    id TEXT PRIMARY KEY NOT NULL,
    model_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT
`;

const CREATE_MODEL_PROXIES_MODEL_ID_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS model_proxies_model_id_idx
  ON model_proxies (model_id)
`;

const CREATE_MODEL_PROXY_CANDIDATES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS model_proxy_candidates (
    id TEXT PRIMARY KEY NOT NULL,
    proxy_id TEXT NOT NULL,
    priority INTEGER NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (proxy_id) REFERENCES model_proxies(id) ON DELETE CASCADE
  ) STRICT
`;

const CREATE_MODEL_PROXY_CANDIDATES_PRIORITY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS model_proxy_candidates_proxy_priority_idx
  ON model_proxy_candidates (proxy_id, priority)
`;

const CREATE_MODEL_PROXY_CANDIDATE_LIMITS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS model_proxy_candidate_limits (
    id TEXT PRIMARY KEY NOT NULL,
    candidate_id TEXT NOT NULL,
    window_type TEXT NOT NULL CHECK(window_type IN ('hours', 'day', 'week')),
    window_hours INTEGER,
    max_tokens INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (candidate_id) REFERENCES model_proxy_candidates(id) ON DELETE CASCADE
  ) STRICT
`;

const CREATE_MODEL_PROXY_CANDIDATE_LIMITS_CANDIDATE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS model_proxy_candidate_limits_candidate_idx
  ON model_proxy_candidate_limits (candidate_id)
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
    input_token INTEGER NOT NULL DEFAULT 0,
    approval_policy TEXT NOT NULL DEFAULT 'approval' CHECK(approval_policy IN ('approval', 'run_all')),
    last_model_provider_source TEXT NOT NULL CHECK(last_model_provider_source IN ('built_in', 'custom')),
    last_model_provider TEXT NOT NULL,
    last_model_id TEXT,
    last_model_name TEXT NOT NULL,
    output_token INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_continued_at TEXT,
    session_id TEXT,
    session_path TEXT,
    session_created_at TEXT,
    source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual', 'scheduled')),
    source_mark TEXT,
    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('running', 'completed', 'error')),
    thinking_level TEXT NOT NULL DEFAULT 'medium' CHECK(thinking_level IN ('off', 'minimal', 'low', 'medium', 'high', 'xhigh')),
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
  ) STRICT
`;

const CREATE_TASKS_WORKSPACE_ID_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx
  ON tasks (workspace_id)
`;

const CREATE_TASKS_SOURCE_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS tasks_source_idx
  ON tasks (source_type, source_mark)
`;

const CREATE_SCHEDULED_AGENT_TASKS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS scheduled_agent_tasks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    thinking_level TEXT NOT NULL DEFAULT 'medium' CHECK(thinking_level IN ('off', 'minimal', 'low', 'medium', 'high', 'xhigh')),
    cron_expression TEXT NOT NULL,
    timezone TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    allow_concurrent_runs INTEGER NOT NULL DEFAULT 0 CHECK(allow_concurrent_runs IN (0, 1)),
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT
`;

const CREATE_SCHEDULED_AGENT_TASKS_ENABLED_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS scheduled_agent_tasks_enabled_idx
  ON scheduled_agent_tasks (enabled)
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

const CREATE_MODEL_TOKEN_USAGE_HOURLY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS model_token_usage_hourly (
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    hour TEXT NOT NULL,
    input_token INTEGER NOT NULL DEFAULT 0,
    output_token INTEGER NOT NULL DEFAULT 0
  ) STRICT
`;

const CREATE_MODEL_TOKEN_USAGE_HOURLY_MODEL_HOUR_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS model_token_usage_hourly_model_hour_idx
  ON model_token_usage_hourly (provider, model_name, hour)
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

const ADD_TASKS_INPUT_TOKEN_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN input_token INTEGER NOT NULL DEFAULT 0
`;

const ADD_TASKS_OUTPUT_TOKEN_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN output_token INTEGER NOT NULL DEFAULT 0
`;

const ADD_TASKS_SOURCE_TYPE_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual' CHECK(source_type IN ('manual', 'scheduled'))
`;

const ADD_TASKS_SOURCE_MARK_COLUMN_SQL = `
  ALTER TABLE tasks ADD COLUMN source_mark TEXT
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
  sqlite.exec(CREATE_MODEL_PROXIES_TABLE_SQL);
  sqlite.exec(CREATE_MODEL_PROXIES_MODEL_ID_INDEX_SQL);
  sqlite.exec(CREATE_MODEL_PROXY_CANDIDATES_TABLE_SQL);
  sqlite.exec(CREATE_MODEL_PROXY_CANDIDATES_PRIORITY_INDEX_SQL);
  sqlite.exec(CREATE_MODEL_PROXY_CANDIDATE_LIMITS_TABLE_SQL);
  sqlite.exec(CREATE_MODEL_PROXY_CANDIDATE_LIMITS_CANDIDATE_INDEX_SQL);
  sqlite.exec(CREATE_WORKSPACES_TABLE_SQL);
  sqlite.exec(CREATE_WORKSPACES_PATH_INDEX_SQL);
  sqlite.exec(CREATE_TASKS_TABLE_SQL);
  sqlite.exec(CREATE_TASKS_WORKSPACE_ID_INDEX_SQL);
  sqlite.exec(CREATE_SCHEDULED_AGENT_TASKS_TABLE_SQL);
  sqlite.exec(CREATE_SCHEDULED_AGENT_TASKS_ENABLED_INDEX_SQL);
  sqlite.exec(CREATE_SUBAGENTS_TABLE_SQL);
  sqlite.exec(CREATE_SUBAGENTS_TASK_ID_INDEX_SQL);
  sqlite.exec(CREATE_MODEL_TOKEN_USAGE_HOURLY_TABLE_SQL);
  sqlite.exec(CREATE_MODEL_TOKEN_USAGE_HOURLY_MODEL_HOUR_INDEX_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_LAST_MODEL_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_ID_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_PATH_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SESSION_CREATED_AT_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_STATUS_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_APPROVAL_POLICY_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_THINKING_LEVEL_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_INPUT_TOKEN_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_OUTPUT_TOKEN_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SOURCE_TYPE_COLUMN_SQL);
  addColumnIfMissing(sqlite, ADD_TASKS_SOURCE_MARK_COLUMN_SQL);
  sqlite.exec(CREATE_TASKS_SOURCE_INDEX_SQL);
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
