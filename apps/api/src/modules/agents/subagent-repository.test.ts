import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabase, migrateDatabase } from "../../db";
import {
  createInMemorySubagentRepository,
  createSqliteSubagentRepository,
  type SubagentRepository
} from "./subagent-repository";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe.each([
  ["memory", () => createInMemorySubagentRepository()],
  ["sqlite", createSqliteFixture]
])("subagent repository (%s)", (_name, createRepository) => {
  it("creates, updates, finds, and deletes subagents", () => {
    const repository = createRepository() as SubagentRepository;
    repository.create({
      agentId: "agent-child",
      createdAt: "2026-06-18T00:00:00.000Z",
      parentAgentId: "agent-parent",
      status: "running",
      taskId: "task-1",
      updatedAt: "2026-06-18T00:00:00.000Z"
    });

    expect(repository.findByAgentId("agent-child")?.status).toBe("running");
    expect(
      repository.updateStatus(
        "agent-child",
        "completed",
        "2026-06-18T00:01:00.000Z"
      )
    ).toEqual(expect.objectContaining({
      status: "completed",
      updatedAt: "2026-06-18T00:01:00.000Z"
    }));

    repository.delete("agent-child");

    expect(repository.findByAgentId("agent-child")).toBeUndefined();
  });
});

function createSqliteFixture(): SubagentRepository {
  const directory = mkdtempSync(join(tmpdir(), "hold-rein-subagents-"));
  tempDirectories.push(directory);
  const database = createDatabase(join(directory, "test.sqlite"));
  migrateDatabase(database.sqlite);
  database.sqlite.exec(`
    INSERT INTO workspaces (id, name, path, created_at, updated_at)
    VALUES ('workspace-1', 'Workspace', '/tmp/workspace', 'now', 'now');
    INSERT INTO tasks (
      id, workspace_id, title, initial_user_message,
      last_model_provider_source, last_model_provider, last_model_name,
      created_at, updated_at
    ) VALUES (
      'task-1', 'workspace-1', 'Task', 'Prompt',
      'built_in', 'openai', 'gpt-4.1', 'now', 'now'
    );
  `);

  return createSqliteSubagentRepository(database);
}
