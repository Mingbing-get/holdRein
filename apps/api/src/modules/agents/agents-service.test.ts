import { describe, expect, it, vi } from "vitest";

import type { TaskRow, WorkspaceRow } from "../../db";
import { createInMemoryWorkspaceRepository } from "../workspaces";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentsService } from "./agents-service";

describe("agents service", () => {
  it("creates workspace and task metadata while starting the agent immediately", async () => {
    let resolveTitle: ((title: string) => void) | undefined;
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
        listMessages: vi.fn(),
        start: vi.fn().mockResolvedValue({
          agentId: "agent-1",
          session: {
            createdAt: "2026-06-08T00:00:00.000Z",
            id: "session-1",
            path: "/sessions/session-1.jsonl"
          },
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
        sessionCreatedAt: "2026-06-08T00:00:00.000Z",
        sessionId: "session-1",
        sessionPath: "/sessions/session-1.jsonl",
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
    resolveTitle?.("Inspect project structure");
    await expect(service.getTaskTitle({ taskId: result.task.id })).resolves.toEqual({
      id: result.task.id,
      title: "Inspect project structure"
    });
    expect(repository.findTaskById(result.task.id)?.title).toBe(
      "Inspect project structure"
    );
  });

  it("continues an existing task by opening its stored session", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "now",
          id: "task-1",
          initialUserMessage: "Initial",
          lastContinuedAt: "now",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: "2026-06-08T00:00:00.000Z",
          sessionId: "session-1",
          sessionPath: "/sessions/session-1.jsonl",
          title: "Task",
          updatedAt: "now",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "now",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "now"
        }
      ]
    });
    const runtime = {
      listMessages: vi.fn(),
      start: vi.fn().mockResolvedValue({
        agentId: "agent-2",
        session: {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "session-1",
          path: "/sessions/session-1.jsonl"
        },
        status: "running"
      })
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    const result = await service.continueTask({
      prompt: "Continue",
      taskId: "task-1"
    });

    expect(result?.task.id).toBe("task-1");
    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "gpt-4.1",
        prompt: "Continue",
        provider: "openai",
        session: {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "session-1",
          path: "/sessions/session-1.jsonl"
        },
        taskId: "task-1",
        workspacePath: "/tmp/workspace"
      })
    );
  });

  it("continues with a new model and stores it for the next run", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "now",
          id: "task-1",
          initialUserMessage: "Initial",
          lastContinuedAt: "now",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: "2026-06-08T00:00:00.000Z",
          sessionId: "session-1",
          sessionPath: "/sessions/session-1.jsonl",
          title: "Task",
          updatedAt: "now",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "now",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "now"
        }
      ]
    });
    const runtime = {
      listMessages: vi.fn(),
      start: vi.fn().mockResolvedValue({
        agentId: "agent-2",
        session: {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "session-1",
          path: "/sessions/session-1.jsonl"
        },
        status: "running"
      })
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-11T00:00:00.000Z"),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    const result = await service.continueTask({
      modelId: "claude-3-5-sonnet",
      prompt: "Continue",
      provider: "anthropic",
      taskId: "task-1"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "claude-3-5-sonnet",
        provider: "anthropic"
      })
    );
    expect(result?.task).toEqual(
      expect.objectContaining({
        lastModelId: "claude-3-5-sonnet",
        lastModelName: "claude-3-5-sonnet",
        lastModelProvider: "anthropic",
        lastModelProviderSource: "built_in"
      })
    );
    expect(repository.findTaskById("task-1")).toEqual(
      expect.objectContaining({
        lastModelId: "claude-3-5-sonnet",
        lastModelProvider: "anthropic"
      })
    );
  });

  it("creates and stores a session when continuing a legacy task", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "now",
          id: "task-1",
          initialUserMessage: "Initial",
          lastContinuedAt: "now",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: null,
          sessionId: null,
          sessionPath: null,
          title: "Task",
          updatedAt: "now",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "now",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "now"
        }
      ]
    });
    const runtime = {
      listMessages: vi.fn(),
      start: vi.fn().mockResolvedValue({
        agentId: "agent-2",
        session: {
          createdAt: "2026-06-11T00:00:00.000Z",
          id: "session-new",
          path: "/sessions/session-new.jsonl"
        },
        status: "running"
      })
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    const result = await service.continueTask({
      prompt: "Continue",
      taskId: "task-1"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.not.objectContaining({ session: expect.anything() })
    );
    expect(result?.task).toEqual(
      expect.objectContaining({
        sessionCreatedAt: "2026-06-11T00:00:00.000Z",
        sessionId: "session-new",
        sessionPath: "/sessions/session-new.jsonl"
      })
    );
  });

  it("loads task messages from the stored session", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "now",
          id: "task-1",
          initialUserMessage: "Initial",
          lastContinuedAt: "now",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: "created",
          sessionId: "session-1",
          sessionPath: "/sessions/session-1.jsonl",
          title: "Task",
          updatedAt: "now",
          workspaceId: "workspace-1"
        }
      ],
      workspaces: [
        {
          createdAt: "now",
          id: "workspace-1",
          name: "workspace",
          path: "/tmp/workspace",
          updatedAt: "now"
        }
      ]
    });
    const runtime = {
      listMessages: vi.fn().mockResolvedValue([
        { content: "Initial", id: "message-1", role: "user", timestamp: 1 }
      ]),
      start: vi.fn()
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.listTaskMessages({ taskId: "task-1" })).resolves.toHaveLength(1);
    expect(runtime.listMessages).toHaveBeenCalledWith({
      session: {
        createdAt: "created",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      },
      workspacePath: "/tmp/workspace"
    });
  });

  it("generates and stores a missing task title when no pending job exists", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          createdAt: "2026-06-08T00:00:00.000Z",
          id: "task-1",
          initialUserMessage: "Explain the project architecture",
          lastContinuedAt: "2026-06-08T00:00:00.000Z",
          lastModelId: "gpt-4.1",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          sessionCreatedAt: null,
          sessionId: null,
          sessionPath: null,
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
        listMessages: vi.fn(),
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
