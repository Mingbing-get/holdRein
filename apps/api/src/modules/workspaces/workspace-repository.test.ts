import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createDatabase, migrateDatabase, type TaskRow, type WorkspaceRow } from "../../db";
import {
  createInMemoryWorkspaceRepository,
  createSqliteWorkspaceRepository,
  type WorkspaceRepository
} from "./workspace-repository";

describe("workspace repository task token usage", () => {
  it("adds token usage to existing task totals", () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        createTask({
          inputToken: 10,
          outputToken: 20
        })
      ],
      workspaces: [createWorkspace()]
    });

    const task = repository.addTaskTokenUsage("task-one", {
      inputToken: 3,
      outputToken: 5
    });

    expect(task).toMatchObject({
      inputToken: 13,
      outputToken: 25
    });
  });

  it("adds model token usage to the same model hour", () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [],
      workspaces: []
    });

    repository.addModelTokenUsageHourly({
      hour: "2026-06-23T08:20:10.000Z",
      inputToken: 11,
      modelName: "gpt-4.1",
      outputToken: 5,
      provider: "openai"
    });
    const usage = repository.addModelTokenUsageHourly({
      hour: "2026-06-23T08:59:59.000Z",
      inputToken: 7,
      modelName: "gpt-4.1",
      outputToken: 3,
      provider: "openai"
    });

    expect(usage).toEqual({
      hour: "2026-06-23T08:00:00.000Z",
      inputToken: 18,
      modelName: "gpt-4.1",
      outputToken: 8,
      provider: "openai"
    });
  });

  it("keeps model token usage separate across models and hours", () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [],
      workspaces: []
    });

    repository.addModelTokenUsageHourly({
      hour: "2026-06-23T08:20:10.000Z",
      inputToken: 11,
      modelName: "gpt-4.1",
      outputToken: 5,
      provider: "openai"
    });
    repository.addModelTokenUsageHourly({
      hour: "2026-06-23T09:00:00.000Z",
      inputToken: 7,
      modelName: "gpt-4.1",
      outputToken: 3,
      provider: "openai"
    });
    const usage = repository.addModelTokenUsageHourly({
      hour: "2026-06-23T08:20:10.000Z",
      inputToken: 2,
      modelName: "claude-3-5-sonnet",
      outputToken: 1,
      provider: "anthropic"
    });

    expect(usage).toEqual({
      hour: "2026-06-23T08:00:00.000Z",
      inputToken: 2,
      modelName: "claude-3-5-sonnet",
      outputToken: 1,
      provider: "anthropic"
    });
  });
});

describe("workspace repository running task source lookup", () => {
  it.each([
    ["in-memory", createInMemoryWorkspaceRepository],
    [
      "sqlite",
      () => {
        const database = createDatabase(
          join(mkdtempSync(join(tmpdir(), "hold-rein-workspace-repo-")), "test.sqlite")
        );
        migrateDatabase(database.sqlite);
        return createSqliteWorkspaceRepository(database);
      }
    ]
  ] satisfies [string, () => WorkspaceRepository][])(
    "finds only running scheduled tasks by source in %s repository",
    (_name, createRepository) => {
      const repository = createRepository();
      repository.createWorkspace(createWorkspace());
      repository.createTask(
        createTask({
          id: "running-scheduled-task",
          sourceMark: "scheduled-1",
          sourceType: "scheduled",
          status: "running"
        })
      );
      repository.createTask(
        createTask({
          id: "completed-scheduled-task",
          sourceMark: "scheduled-1",
          sourceType: "scheduled",
          status: "completed"
        })
      );
      repository.createTask(
        createTask({
          id: "running-manual-task",
          sourceMark: null,
          sourceType: "manual",
          status: "running"
        })
      );

      expect(
        repository.findRunningTaskBySource({
          sourceMark: "scheduled-1",
          sourceType: "scheduled"
        })?.id
      ).toBe("running-scheduled-task");
      expect(
        repository.findRunningTaskBySource({
          sourceMark: "missing",
          sourceType: "scheduled"
        })
      ).toBeUndefined();
    }
  );
});

function createWorkspace(): WorkspaceRow {
  return {
    createdAt: "2026-06-11T00:00:00.000Z",
    id: "workspace-one",
    name: "Workspace One",
    path: "/tmp/workspace",
    updatedAt: "2026-06-11T00:00:00.000Z"
  };
}

function createTask(input: Partial<TaskRow> = {}): TaskRow {
  return {
    approvalPolicy: "approval",
    createdAt: "2026-06-11T00:00:00.000Z",
    id: "task-one",
    initialUserMessage: "Hello",
    inputToken: 0,
    lastContinuedAt: "2026-06-11T00:00:00.000Z",
    lastModelId: "gpt-4.1",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in",
    outputToken: 0,
    sessionCreatedAt: null,
    sessionId: null,
    sessionPath: null,
    sourceMark: null,
    sourceType: "manual",
    status: "completed",
    thinkingLevel: "medium",
    title: "Hello",
    updatedAt: "2026-06-11T00:00:00.000Z",
    workspaceId: "workspace-one",
    ...input
  };
}
