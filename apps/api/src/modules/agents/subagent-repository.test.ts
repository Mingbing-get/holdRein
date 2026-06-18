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
      sessionCreatedAt: "2026-06-18T00:00:00.000Z",
      sessionId: "session-child",
      sessionPath: "/sessions/session-child.jsonl",
      status: "running",
      taskId: "task-1",
      updatedAt: "2026-06-18T00:00:00.000Z"
    });

    expect(repository.findByAgentId("agent-child")).toEqual(
      expect.objectContaining({
        sessionCreatedAt: "2026-06-18T00:00:00.000Z",
        sessionId: "session-child",
        sessionPath: "/sessions/session-child.jsonl",
        status: "running"
      })
    );
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

  it("finds subagents by task", () => {
    const repository = createRepository() as SubagentRepository;

    repository.create({
      agentId: "agent-child-1",
      createdAt: "created",
      parentAgentId: "agent-parent",
      sessionCreatedAt: "session-created-1",
      sessionId: "session-child-1",
      sessionPath: "/sessions/session-child-1.jsonl",
      status: "running",
      taskId: "task-1",
      updatedAt: "created"
    });
    repository.create({
      agentId: "agent-child-2",
      createdAt: "created",
      parentAgentId: "agent-child-1",
      sessionCreatedAt: "session-created-2",
      sessionId: "session-child-2",
      sessionPath: "/sessions/session-child-2.jsonl",
      status: "completed",
      taskId: "task-1",
      updatedAt: "created"
    });
    repository.create({
      agentId: "agent-other",
      createdAt: "created",
      parentAgentId: "agent-parent",
      sessionCreatedAt: "session-created-other",
      sessionId: "session-other",
      sessionPath: "/sessions/session-other.jsonl",
      status: "running",
      taskId: "task-other",
      updatedAt: "created"
    });

    expect(repository.findByTaskId("task-1")).toEqual([
      expect.objectContaining({ agentId: "agent-child-1" }),
      expect.objectContaining({ agentId: "agent-child-2" })
    ]);
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
    INSERT INTO tasks (
      id, workspace_id, title, initial_user_message,
      last_model_provider_source, last_model_provider, last_model_name,
      created_at, updated_at
    ) VALUES (
      'task-other', 'workspace-1', 'Other Task', 'Prompt',
      'built_in', 'openai', 'gpt-4.1', 'now', 'now'
    );
  `);

  return createSqliteSubagentRepository(database);
}
