import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { createDatabase, migrateDatabase } from "../../db";
import {
  createInMemoryAgentMessageRepository,
  createSqliteAgentMessageRepository
} from "./agent-message-repository";

describe.each([
  [
    "memory",
    () => createInMemoryAgentMessageRepository()
  ],
  [
    "sqlite",
    () => {
      const database = createDatabase(`/tmp/hold-rein-${randomUUID()}.sqlite`);
      migrateDatabase(database.sqlite);
      database.sqlite.exec(`
        INSERT INTO workspaces (id, name, path, created_at, updated_at)
        VALUES ('workspace-1', 'Workspace', '/tmp/workspace', 'now', 'now');
        INSERT INTO tasks (
          id, workspace_id, title, initial_user_message,
          last_model_provider_source, last_model_provider, last_model_name,
          created_at, updated_at, last_continued_at
        ) VALUES (
          'task-1', 'workspace-1', '', 'Prompt',
          'built_in', 'openai', 'gpt-4.1', 'now', 'now', 'now'
        );
      `);
      return createSqliteAgentMessageRepository(database);
    }
  ]
])("agent message repository (%s)", (_name, createRepository) => {
  it("appends and lists messages in task sequence order", () => {
    const repository = createRepository();
    const first = repository.append({
      agentId: "agent-1",
      createdAt: "now",
      message: {
        content: [{ text: "Prompt", type: "text" }],
        id: "message-1",
        role: "user",
        timestamp: 1
      },
      taskId: "task-1"
    });
    const second = repository.append({
      agentId: "agent-1",
      createdAt: "later",
      message: {
        content: [{ text: "Answer", type: "text" }],
        id: "message-2",
        role: "assistant",
        api: "openai-responses",
        model: "gpt-4.1",
        provider: "openai",
        stopReason: "stop",
        timestamp: 2
      },
      taskId: "task-1"
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(repository.listByTaskId("task-1").map((row) => row.message.id)).toEqual([
      "message-1",
      "message-2"
    ]);
  });
});
