import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";

import * as schema from "./schema";
import { ensureDatabaseDirectory, migrateDatabase } from "./index";

describe("database", () => {
  it("exports the custom provider, workspace, and task tables", () => {
    expect(schema).toHaveProperty("customModelProviders");
    expect(schema).toHaveProperty("providerApiKeys");
    expect(schema).toHaveProperty("customProviderModels");
    expect(schema).toHaveProperty("workspaces");
    expect(schema).toHaveProperty("tasks");
  });

  it("creates the application database schema", () => {
    const exec = vi.fn();

    migrateDatabase({ exec } as { exec: (sql: string) => void });

    expect(exec).toHaveBeenCalledTimes(11);
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
      expect.stringContaining("last_model_provider_source TEXT NOT NULL")
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
      11,
      expect.stringContaining("CREATE INDEX IF NOT EXISTS tasks_workspace_id_idx")
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
        .prepare("SELECT title, last_model_provider_source FROM tasks")
        .get();

      expect(task).toEqual({
        last_model_provider_source: "built_in",
        title: "Add persistence"
      });
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
