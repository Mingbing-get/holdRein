import { describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import { createActiveTaskRunRegistry } from "../task/active-run-registry";
import { createAgentsService } from ".";
import { recoverInterruptedAgentRuns } from "./startup-recovery";

describe("agents service task status", () => {
  it("keeps a started task running when only the agent run ends", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const eventBus = createAgentEventBus();
    const activeTaskRuns = createActiveTaskRunRegistry();
    const service = createAgentsService({
      activeTaskRuns,
      approvalStore: createAgentApprovalStore(),
      eventBus,
      now: () => new Date("2026-06-11T00:00:00.000Z"),
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockResolvedValue(createRun("agent-1"))
      },
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Task") }
    });

    const result = await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    expect(repository.findTaskById(result.task.id)?.status).toBe("running");
    expect(activeTaskRuns.getAgentId(result.task.id)).toBe("agent-1");

    eventBus.emit({ agentId: "agent-1", type: "agent_end" });

    expect(repository.findTaskById(result.task.id)?.status).toBe("running");
    expect(activeTaskRuns.getAgentId(result.task.id)).toBe("agent-1");
  });

  it("marks a started task completed when the task ends", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const eventBus = createAgentEventBus();
    const activeTaskRuns = createActiveTaskRunRegistry();
    const service = createAgentsService({
      activeTaskRuns,
      approvalStore: createAgentApprovalStore(),
      eventBus,
      now: () => new Date("2026-06-11T00:00:00.000Z"),
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockResolvedValue(createRun("agent-1"))
      },
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Task") }
    });

    const result = await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    eventBus.emit({ agentId: "agent-1", type: "task_end" });

    expect(repository.findTaskById(result.task.id)?.status).toBe("completed");
    expect(activeTaskRuns.getAgentId(result.task.id)).toBeUndefined();
  });

  it("marks a new task as error when runtime startup fails", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-11T00:00:00.000Z"),
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockRejectedValue(new Error("Unknown model"))
      },
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Task") }
    });

    await expect(
      service.startAgent({
        modelId: "missing",
        prompt: "Inspect",
        provider: "openai",
        workspacePath: "/tmp/workspace"
      })
    ).rejects.toThrow("Unknown model");

    const workspace = repository.findWorkspaceByPath("/tmp/workspace");
    expect(
      repository.listTasksByWorkspaceId({
        limit: 1,
        workspaceId: workspace?.id ?? ""
      })[0]?.status
    ).toBe("error");
  });

  it("does not mark a task error for a tool execution error message", async () => {
    const repository = createInMemoryWorkspaceRepository();
    const eventBus = createAgentEventBus();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus,
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockResolvedValue(createRun("agent-1"))
      },
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Task") }
    });
    const result = await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Run a tool",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    eventBus.emit({
      agentId: "agent-1",
      payload: { isError: true, role: "toolResult" },
      type: "message_end"
    });

    expect(repository.findTaskById(result.task.id)?.status).toBe("running");
  });

  it("interrupts the active agent for a running task", async () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [createCompletedTask({ status: "running" })],
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
    const activeTaskRuns = createActiveTaskRunRegistry();
    activeTaskRuns.register("task-1", "agent-1");
    const runtime = {
      interrupt: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn(),
      start: vi.fn()
    };
    const service = createAgentsService({
      activeTaskRuns,
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.interruptTask({ taskId: "task-1" })).resolves.toEqual({
      agentId: "agent-1",
      status: "interrupted",
      taskId: "task-1"
    });
    expect(runtime.interrupt).toHaveBeenCalledWith("agent-1");
    expect(repository.findTaskById("task-1")?.status).toBe("error");
    expect(activeTaskRuns.getAgentId("task-1")).toBeUndefined();
  });

  it("reports not running when a task has no active agent", async () => {
    const { service } = createStatusService();

    await expect(service.interruptTask({ taskId: "task-1" })).resolves.toEqual({
      status: "not_running",
      taskId: "task-1"
    });
  });

  it("marks a continued task running before startup and error when the run fails", async () => {
    const eventBus = createAgentEventBus();
    const repository = createInMemoryWorkspaceRepository({
      tasks: [createCompletedTask()],
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
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus,
      repository,
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn().mockImplementation(async () => {
          expect(repository.findTaskById("task-1")?.status).toBe("running");
          return createRun("agent-2");
        })
      },
      titleGenerator: { generateTitle: vi.fn() }
    });

    await service.continueTask({ prompt: "Continue", taskId: "task-1" });
    eventBus.emit({
      agentId: "agent-2",
      payload: { message: "Model connection failed" },
      type: "agent_error"
    });

    expect(repository.findTaskById("task-1")?.status).toBe("error");
  });

  it("marks persisted running task state interrupted during startup recovery", () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        createCompletedTask({ status: "running" }),
        createCompletedTask({ id: "task-2", status: "completed" })
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
      createSubagent({ agentId: "agent-running", status: "running" }),
      createSubagent({ agentId: "agent-completed", status: "completed" })
    ]);

    expect(
      recoverInterruptedAgentRuns({
        now: "2026-06-11T01:00:00.000Z",
        repository,
        subagentRepository
      })
    ).toEqual({
      interruptedSubagentIds: ["agent-running"],
      interruptedTaskIds: ["task-1"]
    });

    expect(repository.findTaskById("task-1")).toEqual(
      expect.objectContaining({
        status: "error",
        updatedAt: "2026-06-11T01:00:00.000Z"
      })
    );
    expect(repository.findTaskById("task-2")?.status).toBe("completed");
    expect(subagentRepository.findByAgentId("agent-running")).toEqual(
      expect.objectContaining({
        status: "interrupted",
        updatedAt: "2026-06-11T01:00:00.000Z"
      })
    );
    expect(subagentRepository.findByAgentId("agent-completed")?.status).toBe(
      "completed"
    );
  });

  it("keeps in-process active tasks running during startup recovery", () => {
    const repository = createInMemoryWorkspaceRepository({
      tasks: [createCompletedTask({ status: "running" })],
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
    const activeTaskRuns = createActiveTaskRunRegistry();
    activeTaskRuns.register("task-1", "agent-1");

    expect(
      recoverInterruptedAgentRuns({
        activeTaskRuns,
        now: "2026-06-11T01:00:00.000Z",
        repository,
        subagentRepository: createInMemorySubagentRepository()
      })
    ).toEqual({
      interruptedSubagentIds: [],
      interruptedTaskIds: []
    });

    expect(repository.findTaskById("task-1")).toEqual(
      expect.objectContaining({
        status: "running",
        updatedAt: "now"
      })
    );
  });
});

function createCompletedTask(input: {
  id?: string;
  status?: "running" | "completed" | "error";
} = {}) {
  return {
    createdAt: "now",
    id: input.id ?? "task-1",
    initialUserMessage: "Initial",
    lastContinuedAt: "now",
    lastModelId: "gpt-4.1",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in" as const,
    sessionCreatedAt: null,
    sessionId: null,
    sessionPath: null,
    status: input.status ?? "completed" as const,
    title: "Task",
    updatedAt: "now",
    workspaceId: "workspace-1"
  };
}

function createSubagent(input: {
  agentId: string;
  status: "completed" | "interrupted" | "running";
}) {
  return {
    agentId: input.agentId,
    agentName: "subagent",
    createdAt: "now",
    depth: 1,
    parentAgentId: "agent-parent",
    sessionCreatedAt: null,
    sessionId: null,
    sessionPath: null,
    status: input.status,
    taskId: "task-1",
    updatedAt: "now"
  };
}

function createStatusService() {
  const repository = createInMemoryWorkspaceRepository({
    tasks: [createCompletedTask()],
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
  const service = createAgentsService({
    approvalStore: createAgentApprovalStore(),
    eventBus: createAgentEventBus(),
    repository,
    runtime: {
      interrupt: vi.fn(),
      listMessages: vi.fn(),
      start: vi.fn()
    },
    titleGenerator: { generateTitle: vi.fn() }
  });

  return { repository, service };
}

function createRun(agentId: string) {
  return {
    agentId,
    session: {
      createdAt: "2026-06-11T00:00:00.000Z",
      id: "session-1",
      path: "/sessions/session-1.jsonl"
    },
    status: "running" as const
  };
}
