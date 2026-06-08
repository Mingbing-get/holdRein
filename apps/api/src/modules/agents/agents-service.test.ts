import { describe, expect, it, vi } from "vitest";

import type { TaskRow, WorkspaceRow } from "../../db";
import { createInMemoryWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentsService } from "./agents-service";

describe("agents service", () => {
  it("creates workspace and task metadata while starting the agent immediately", async () => {
    let resolveTitle: (title: string) => void = () => {};
    const titlePromise = new Promise<string>((resolve) => {
      resolveTitle = resolve;
    });
    const repository = createInMemoryWorkspaceRepository();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-08T00:00:00.000Z"),
      repository,
      runtime: {
        start: vi.fn().mockResolvedValue({
          agentId: "agent-1",
          sessionId: "session-1",
          status: "running"
        })
      },
      titleGenerator: {
        generateTitle: vi.fn().mockReturnValue(titlePromise)
      }
    });

    const result = await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Inspect this project and explain the structure",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    expect(result).toEqual({
      agentId: "agent-1",
      sessionId: "session-1",
      status: "running",
      task: expect.objectContaining({
        initialUserMessage: "Inspect this project and explain the structure",
        title: "",
        workspaceId: result.workspace.id
      }) as TaskRow,
      workspace: expect.objectContaining({
        name: "workspace",
        path: "/tmp/workspace"
      }) as WorkspaceRow
    });
    expect(repository.findWorkspaceByPath("/tmp/workspace")).toEqual(
      result.workspace
    );

    resolveTitle("Inspect project structure");
    await expect(service.getTaskTitle({ taskId: result.task.id })).resolves.toEqual({
      id: result.task.id,
      title: "Inspect project structure"
    });
    expect(repository.findTaskById(result.task.id)?.title).toBe(
      "Inspect project structure"
    );
  });

  it("generates and stores a missing task title when no pending job exists", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "task-1",
          initialUserMessage: "Explain the project architecture",
          lastContinuedAt: "2026-06-08T00:00:00.000Z",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          title: "",
          updatedAt: "2026-06-08T00:00:00.000Z",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "2026-06-08T00:00:00.000Z"
        }
      ]
    });
    const titleGenerator = {
      generateTitle: vi.fn().mockResolvedValue("Explain architecture")
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-08T00:01:00.000Z"),
      repository,
      runtime: {
        start: vi.fn()
      },
      titleGenerator
    });

    await expect(service.getTaskTitle({ taskId: "task-1" })).resolves.toEqual({
      id: "task-1",
      title: "Explain architecture"
    });
    expect(titleGenerator.generateTitle).toHaveBeenCalledWith({
      modelId: "gpt-4.1",
      prompt: "Explain the project architecture",
      provider: "openai"
    });
    expect(repository.findTaskById("task-1")?.title).toBe(
      "Explain architecture"
    );
  });
});
