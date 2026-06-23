import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import * as schema from "./schema";
import { ensureDatabaseDirectory, migrateDatabase } from "./index";

describe("database", () => {
  it("exports the custom provider, workspace, task, and model token usage tables", () => {
    expect(schema).toHaveProperty("customModelProviders");
    expect(schema).toHaveProperty("providerApiKeys");
    expect(schema).toHaveProperty("customProviderModels");
    expect(schema).toHaveProperty("workspaces");
    expect(schema).toHaveProperty("tasks");
    expect(schema).toHaveProperty("subagents");
    expect(schema).toHaveProperty("modelTokenUsageHourly");
    expect(schema).not.toHaveProperty("taskMessages");
  });

  it("creates the application database schema", () => {
    const exec = vi.fn();

    migrateDatabase({ exec } as { exec: (sql: string) => void });

    expect(exec).toHaveBeenCalledTimes(29);
    expect(exec).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS custom_model_providers")
    );
    expect(exec).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS provider_api_keys")
    );
    expect(exec).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS custom_provider_models")
    );
    expect(exec).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining("ALTER TABLE custom_provider_models ADD COLUMN name")
    );
    expect(exec).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS workspaces")
    );
    expect(exec).toHaveBeenNthCalledWith(
      9,
      expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS workspaces_path_idx")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS tasks")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("approval_policy TEXT NOT NULL")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("thinking_level TEXT NOT NULL")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("last_model_provider_source TEXT NOT NULL")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("input_token INTEGER NOT NULL DEFAULT 0")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("output_token INTEGER NOT NULL DEFAULT 0")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("CHECK(last_model_provider_source IN ('built_in', 'custom'))")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("last_continued_at TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("session_id TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("session_path TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("session_created_at TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("status TEXT NOT NULL")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("CHECK(status IN ('running', 'completed', 'interrupted'))")
    );
    expect(exec).toHaveBeenNthCalledWith(
      11,
      expect.stringContaining("CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS subagents")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("agent_name TEXT NOT NULL")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("session_id TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("session_path TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      12,
      expect.stringContaining("session_created_at TEXT")
    );
    expect(exec).toHaveBeenNthCalledWith(
      13,
      expect.stringContaining("CREATE INDEX IF NOT EXISTS subagents_task_id_idx")
    );
    expect(exec).toHaveBeenNthCalledWith(
      14,
      expect.stringContaining("CREATE TABLE IF NOT EXISTS model_token_usage_hourly")
    );
    expect(exec).toHaveBeenNthCalledWith(
      15,
      expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS model_token_usage_hourly_model_hour_idx")
    );
    expect(exec).toHaveBeenNthCalledWith(
      25,
      expect.stringContaining("ALTER TABLE subagents ADD COLUMN agent_name")
    );
    expect(exec).toHaveBeenLastCalledWith(
      expect.stringContaining("DROP TABLE IF EXISTS task_messages")
    );
  });

  it("applies workspace and task schema constraints to sqlite", () => {
    const sqlite = new Database(":memory:");

    try {
      migrateDatabase(sqlite);
      sqlite
        .prepare(
          `
            INSERT INTO workspaces (id, name, path, created_at, updated_at)
            VALUES ('workspace-1', 'Agent Lab', '/tmp/agent-lab', '2026-06-08T00:00:00.000Z', '2026-06-08T00:00:00.000Z')
          `
        )
        .run();
      sqlite
        .prepare(
          `
            INSERT INTO tasks (
              id,
              workspace_id,
              title,
              initial_user_message,
              last_model_provider_source,
              last_model_provider,
              last_model_name,
              created_at,
              updated_at,
              last_continued_at
            )
            VALUES (
              'task-1',
              'workspace-1',
              'Add persistence',
              '添加两张表用于管理右侧的工作空间与任务',
              'built_in',
              'openai',
              'gpt-4.1',
              '2026-06-08T00:00:00.000Z',
              '2026-06-08T00:00:00.000Z',
              NULL
            )
          `
        )
        .run();

      const task = sqlite
        .prepare(
          "SELECT title, input_token, output_token, last_model_provider_source, session_id, session_path, session_created_at, status FROM tasks"
        )
        .get();

      expect(task).toEqual({
        input_token: 0,
        last_model_provider_source: "built_in",
        output_token: 0,
        session_created_at: null,
        session_id: null,
        session_path: null,
        status: "completed",
        title: "Add persistence"
      });
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_messages'"
          )
          .get()
      ).toBeUndefined();
      expect(() =>
        sqlite
          .prepare(
            `
              INSERT INTO tasks (
                id,
                workspace_id,
                title,
                initial_user_message,
                last_model_provider_source,
                last_model_provider,
                last_model_name,
                created_at,
                updated_at
              )
              VALUES (
                'task-invalid',
                'workspace-1',
                'Invalid model source',
                'test',
                'unknown',
                'openai',
                'gpt-4.1',
                '2026-06-08T00:00:00.000Z',
                '2026-06-08T00:00:00.000Z'
              )
            `
          )
          .run()
      ).toThrow();
      sqlite.prepare(`
        INSERT INTO subagents (
          agent_id, agent_name, parent_agent_id, task_id, status,
          session_id, session_path, session_created_at,
          created_at, updated_at
        ) VALUES (
          'agent-child', 'researcher', 'agent-parent', 'task-1', 'running',
          'session-child', '/sessions/session-child.jsonl', 'created',
          'now', 'now'
        )
      `).run();
      expect(
        sqlite.prepare(
          "SELECT agent_name, session_id, session_path, session_created_at, status FROM subagents WHERE agent_id = 'agent-child'"
        ).get()
      ).toEqual({
        agent_name: "researcher",
        session_created_at: "created",
        session_id: "session-child",
        session_path: "/sessions/session-child.jsonl",
        status: "running"
      });
      sqlite.prepare(
        "UPDATE subagents SET status = 'interrupted' WHERE agent_id = 'agent-child'"
      ).run();
      expect(
        sqlite.prepare(
          "SELECT status FROM subagents WHERE agent_id = 'agent-child'"
        ).get()
      ).toEqual({ status: "interrupted" });
      expect(() => sqlite.prepare(`
        INSERT INTO subagents (
          agent_id, agent_name, parent_agent_id, task_id, status,
          session_id, session_path, session_created_at,
          created_at, updated_at
        ) VALUES (
          'agent-invalid', 'researcher', 'agent-parent', 'task-1', 'failed',
          'session-invalid', '/sessions/session-invalid.jsonl', 'created',
          'now', 'now'
        )
      `).run()).toThrow();
      sqlite.prepare(`
        INSERT INTO model_token_usage_hourly (
          provider, model_name, hour, input_token, output_token
        ) VALUES (
          'openai', 'gpt-4.1', '2026-06-23T08:00:00.000Z', 11, 5
        )
      `).run();
      expect(sqlite.prepare(`
        SELECT provider, model_name, hour, input_token, output_token
        FROM model_token_usage_hourly
      `).get()).toEqual({
        hour: "2026-06-23T08:00:00.000Z",
        input_token: 11,
        model_name: "gpt-4.1",
        output_token: 5,
        provider: "openai"
      });
      expect(() => sqlite.prepare(`
        INSERT INTO model_token_usage_hourly (
          provider, model_name, hour, input_token, output_token
        ) VALUES (
          'openai', 'gpt-4.1', '2026-06-23T08:00:00.000Z', 1, 1
        )
      `).run()).toThrow();
      sqlite.prepare("DELETE FROM tasks WHERE id = 'task-1'").run();
      expect(sqlite.prepare("SELECT * FROM subagents").all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("upgrades legacy tasks and removes the task messages table", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(`
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL,
          title TEXT NOT NULL,
          initial_user_message TEXT NOT NULL,
          last_model_provider_source TEXT NOT NULL,
          last_model_provider TEXT NOT NULL,
          last_model_name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_continued_at TEXT
        ) STRICT;
        CREATE TABLE task_messages (
          id TEXT PRIMARY KEY NOT NULL
        ) STRICT;
        INSERT INTO workspaces (id, name, path, created_at, updated_at)
        VALUES ('workspace-1', 'Workspace', '/tmp/workspace', 'now', 'now');
        INSERT INTO tasks (
          id, workspace_id, title, initial_user_message,
          last_model_provider_source, last_model_provider, last_model_name,
          created_at, updated_at, last_continued_at
        ) VALUES (
          'task-1', 'workspace-1', 'Legacy', 'Prompt',
          'built_in', 'openai', 'gpt-4.1', 'now', 'now', 'now'
        );
      `);

      migrateDatabase(sqlite);

      expect(
        sqlite
          .prepare(
            "SELECT id, input_token, output_token, session_id, session_path, session_created_at, status FROM tasks WHERE id = 'task-1'"
          )
          .get()
      ).toEqual({
        id: "task-1",
        input_token: 0,
        output_token: 0,
        session_created_at: null,
        session_id: null,
        session_path: null,
        status: "completed"
      });
      expect(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'task_messages'"
          )
          .get()
      ).toBeUndefined();
    } finally {
      sqlite.close();
    }
  });

  it("upgrades legacy subagents with nullable session metadata columns and interrupted status support", () => {
    const sqlite = new Database(":memory:");

    try {
      sqlite.exec(`
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE tasks (
          id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL,
          title TEXT NOT NULL,
          initial_user_message TEXT NOT NULL,
          last_model_provider_source TEXT NOT NULL,
          last_model_provider TEXT NOT NULL,
          last_model_name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        ) STRICT;
        CREATE TABLE subagents (
          agent_id TEXT PRIMARY KEY NOT NULL,
          parent_agent_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('running', 'completed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        ) STRICT;
        INSERT INTO workspaces (id, name, path, created_at, updated_at)
        VALUES ('workspace-1', 'Workspace', '/tmp/workspace', 'now', 'now');
        INSERT INTO tasks (
          id, workspace_id, title, initial_user_message,
          last_model_provider_source, last_model_provider, last_model_name,
          created_at, updated_at
        ) VALUES (
          'task-1', 'workspace-1', 'Legacy', 'Prompt',
          'built_in', 'openai', 'gpt-4.1', 'now', 'now'
        );
        INSERT INTO subagents (
          agent_id, parent_agent_id, task_id, status, created_at, updated_at
        ) VALUES (
          'agent-child', 'agent-parent', 'task-1', 'running', 'now', 'now'
        );
      `);

      migrateDatabase(sqlite);

      expect(
        sqlite
          .prepare(
            "SELECT agent_name, session_id, session_path, session_created_at FROM subagents WHERE agent_id = 'agent-child'"
          )
          .get()
      ).toEqual({
        agent_name: "subagent",
        session_created_at: null,
        session_id: null,
        session_path: null
      });
      sqlite.prepare(
        "UPDATE subagents SET status = 'interrupted' WHERE agent_id = 'agent-child'"
      ).run();
      expect(
        sqlite
          .prepare("SELECT status FROM subagents WHERE agent_id = 'agent-child'")
          .get()
      ).toEqual({ status: "interrupted" });
    } finally {
      sqlite.close();
    }
  });

  it("creates parent directories for the sqlite database path", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "hold-rein-db-"));
    const databasePath = join(tempRoot, "nested", "hold-rein.sqlite");

    try {
      const resolvedPath = ensureDatabaseDirectory(databasePath);

      expect(resolvedPath).toContain("/nested/hold-rein.sqlite");
      expect(() => rmSync(join(tempRoot, "nested"), { recursive: true })).not.toThrow();
    } finally {
      rmSync(tempRoot, { force: true, recursive: true });
    }
  });
});
