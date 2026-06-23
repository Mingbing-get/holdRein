import { describe, expect, it } from "vitest";

import type { TaskRow, WorkspaceRow } from "../../db";
import { createInMemoryWorkspaceRepository } from "./workspace-repository";

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

function createTask(input: {
  inputToken: number;
  outputToken: number;
}): TaskRow {
  return {
    approvalPolicy: "approval",
    createdAt: "2026-06-11T00:00:00.000Z",
    id: "task-one",
    initialUserMessage: "Hello",
    inputToken: input.inputToken,
    lastContinuedAt: "2026-06-11T00:00:00.000Z",
    lastModelId: "gpt-4.1",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in",
    outputToken: input.outputToken,
    sessionCreatedAt: null,
    sessionId: null,
    sessionPath: null,
    status: "completed",
    thinkingLevel: "medium",
    title: "Hello",
    updatedAt: "2026-06-11T00:00:00.000Z",
    workspaceId: "workspace-one"
  };
}
