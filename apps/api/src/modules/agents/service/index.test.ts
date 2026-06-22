import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TaskRow, WorkspaceRow } from "../../../db";
import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentsService } from ".";
import { createInMemorySubagentRepository } from "../subagent/repository";

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("agents service", () => {
  it("renames an existing task", async () => {
    const { repository, service } = createTaskService();

    await expect(
      service.renameTask({ taskId: "task-1", title: "Renamed task" })
    ).resolves.toEqual({ id: "task-1", title: "Renamed task" });
    expect(repository.findTaskById("task-1")?.title).toBe("Renamed task");
  });

  it("deletes a completed task and its session file", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "hold-rein-task-delete-"));
    temporaryPaths.push(rootPath);
    const sessionPath = join(rootPath, "session.jsonl");
    await writeFile(sessionPath, "{}");
    const { repository, service } = createTaskService({ sessionPath });

    await expect(service.deleteTask({ taskId: "task-1" })).resolves.toEqual({
      status: "deleted",
      taskId: "task-1"
    });

    expect(repository.findTaskById("task-1")).toBeUndefined();
    await expect(access(sessionPath)).rejects.toThrow();
  });

  it("refuses to delete a running task", async () => {
    const { repository, service } = createTaskService({ status: "running" });

    await expect(service.deleteTask({ taskId: "task-1" })).resolves.toEqual({
      status: "running",
      taskId: "task-1"
    });
    expect(repository.findTaskById("task-1")).toBeDefined();
  });

  it("keeps a task when its session file cannot be deleted", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "hold-rein-task-delete-"));
    temporaryPaths.push(rootPath);
    const sessionPath = join(rootPath, "session-directory");
    await mkdir(sessionPath);
    const { repository, service } = createTaskService({ sessionPath });

    await expect(service.deleteTask({ taskId: "task-1" })).rejects.toThrow();
    expect(repository.findTaskById("task-1")).toBeDefined();
  });

  it("reports unknown task mutations", async () => {
    const { service } = createTaskService();

    await expect(service.deleteTask({ taskId: "missing" })).resolves.toEqual({
      status: "not_found",
      taskId: "missing"
    });
    await expect(
      service.renameTask({ taskId: "missing", title: "Missing" })
    ).resolves.toBeNull();
  });

  it("keeps a manual rename when a pending generated title finishes", async () => {
    let resolveTitle: ((title: string) => void) | undefined;
    const titlePromise = new Promise<string>((resolve) => {
      resolveTitle = resolve;
    });
    const repository = createInMemoryWorkspaceRepository();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockResolvedValue({
          agentId: "agent-1",
          session: {
            createdAt: "2026-06-11T00:00:00.000Z",
            id: "session-1",
            path: "/sessions/session-1.jsonl"
          },
          status: "running"
        })
      },
      titleGenerator: { generateTitle: vi.fn().mockReturnValue(titlePromise) }
    });
    const started = await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Initial",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    await service.renameTask({ taskId: started.task.id, title: "Manual title" });
    resolveTitle?.("Generated title");
    await service.getTaskTitle({ taskId: started.task.id });

    expect(repository.findTaskById(started.task.id)?.title).toBe("Manual title");
  });

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
        interrupt: vi.fn(),
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
        status: "running",
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
          status: "completed",
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
      interrupt: vi.fn(),
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
          status: "completed",
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
      interrupt: vi.fn(),
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
          status: "completed",
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
      interrupt: vi.fn(),
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
          status: "completed",
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
      interrupt: vi.fn(),
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

    await expect(service.listTaskMessages({ taskId: "task-1" })).resolves.toEqual({
      messages: [
        { content: "Initial", id: "message-1", role: "user", timestamp: 1 }
      ],
      subagents: []
    });
    expect(runtime.listMessages).toHaveBeenCalledWith({
      session: {
        createdAt: "created",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      },
      workspacePath: "/tmp/workspace"
    });
  });

  it("loads task messages with every persisted subagent history", async () => {
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
          sessionCreatedAt: "parent-created",
          sessionId: "session-parent",
          sessionPath: "/sessions/session-parent.jsonl",
          status: "completed",
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
    const subagentRepository = createInMemorySubagentRepository([
      {
        agentName: "researcher",
        agentId: "agent-child",
        createdAt: "now",
        parentAgentId: "agent-parent",
        sessionCreatedAt: "child-created",
        sessionId: "session-child",
        sessionPath: "/sessions/session-child.jsonl",
        status: "completed",
        taskId: "task-1",
        updatedAt: "now"
      },
      {
        agentName: "reviewer",
        agentId: "agent-grandchild",
        createdAt: "now",
        parentAgentId: "agent-child",
        sessionCreatedAt: "grandchild-created",
        sessionId: "session-grandchild",
        sessionPath: "/sessions/session-grandchild.jsonl",
        status: "running",
        taskId: "task-1",
        updatedAt: "now"
      },
      {
        agentName: "subagent",
        agentId: "agent-legacy",
        createdAt: "now",
        parentAgentId: "agent-parent",
        sessionCreatedAt: null,
        sessionId: null,
        sessionPath: null,
        status: "completed",
        taskId: "task-1",
        updatedAt: "now"
      },
      {
        agentName: "subagent",
        agentId: "agent-broken",
        createdAt: "now",
        parentAgentId: "agent-parent",
        sessionCreatedAt: "broken-created",
        sessionId: "session-broken",
        sessionPath: "/sessions/session-broken.jsonl",
        status: "completed",
        taskId: "task-1",
        updatedAt: "now"
      }
    ]);
    const runtime = {
      interrupt: vi.fn(),
      listMessages: vi.fn(async ({ session }: { session: { id: string } }) => {
        if (session.id === "session-broken") {
          throw new Error("Cannot read child session");
        }
        return [
          {
            content: `History for ${session.id}`,
            id: `message-${session.id}`,
            role: "user" as const,
            timestamp: 1
          }
        ];
      }),
      start: vi.fn()
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      subagentRepository,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.listTaskMessages({ taskId: "task-1" })).resolves.toEqual({
      messages: [
        {
          content: "History for session-parent",
          id: "message-session-parent",
          role: "user",
          timestamp: 1
        }
      ],
      subagents: [
        {
          agentName: "researcher",
          agentId: "agent-child",
          messages: [
            {
              content: "History for session-child",
              id: "message-session-child",
              role: "user",
              timestamp: 1
            }
          ],
          parentAgentId: "agent-parent",
          status: "completed"
        },
        {
          agentName: "reviewer",
          agentId: "agent-grandchild",
          messages: [
            {
              content: "History for session-grandchild",
              id: "message-session-grandchild",
              role: "user",
              timestamp: 1
            }
          ],
          parentAgentId: "agent-child",
          status: "running"
        },
        {
          agentName: "subagent",
          agentId: "agent-legacy",
          messages: [],
          parentAgentId: "agent-parent",
          status: "completed"
        },
        {
          agentName: "subagent",
          agentId: "agent-broken",
          messages: [],
          parentAgentId: "agent-parent",
          status: "completed"
        }
      ]
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
          status: "completed",
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
        interrupt: vi.fn(),
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

function createTaskService(input: {
  sessionPath?: string;
  status?: TaskRow["status"];
} = {}) {
  const repository = createInMemoryWorkspaceRepository({
    tasks: [
      {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "task-1",
        initialUserMessage: "Initial",
        lastContinuedAt: "2026-06-11T00:00:00.000Z",
        lastModelId: "gpt-4.1",
        lastModelName: "gpt-4.1",
        lastModelProvider: "openai",
        lastModelProviderSource: "built_in",
        sessionCreatedAt: input.sessionPath ? "2026-06-11T00:00:00.000Z" : null,
        sessionId: input.sessionPath ? "session-1" : null,
        sessionPath: input.sessionPath ?? null,
        status: input.status ?? "completed",
        title: "Task",
        updatedAt: "2026-06-11T00:00:00.000Z",
        workspaceId: "workspace-1"
      }
    ],
    workspaces: [
      {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        updatedAt: "2026-06-11T00:00:00.000Z"
      }
    ]
  });
  const service = createAgentsService({
    approvalStore: createAgentApprovalStore(),
    eventBus: createAgentEventBus(),
    now: () => new Date("2026-06-11T01:00:00.000Z"),
    repository,
    runtime: { interrupt: vi.fn(), listMessages: vi.fn(), start: vi.fn() },
    titleGenerator: { generateTitle: vi.fn() }
  });

  return { repository, service };
}
