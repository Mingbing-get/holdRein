import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createActiveTaskRunRegistry } from "../task/active-run-registry";
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

describe("agents service subagent lifecycle", () => {
  it("interrupts running subagents and persists them as interrupted", async () => {
    const repository = createRepository({ status: "running" });
    const subagentRepository = createInMemorySubagentRepository([
      createSubagent({ agentId: "agent-child-running", status: "running" }),
      createSubagent({ agentId: "agent-child-completed", status: "completed" })
    ]);
    const activeTaskRuns = createActiveTaskRunRegistry();
    activeTaskRuns.register("task-1", "agent-parent");
    const runtime = {
      interrupt: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn(),
      start: vi.fn()
    };
    const service = createAgentsService({
      activeTaskRuns,
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-18T00:00:00.000Z"),
      repository,
      runtime,
      subagentRepository,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.interruptTask({ taskId: "task-1" })).resolves.toEqual({
      agentId: "agent-parent",
      status: "interrupted",
      taskId: "task-1"
    });

    expect(runtime.interrupt).toHaveBeenCalledWith("agent-parent");
    expect(runtime.interrupt).toHaveBeenCalledWith("agent-child-running");
    expect(runtime.interrupt).not.toHaveBeenCalledWith("agent-child-completed");
    expect(subagentRepository.findByAgentId("agent-child-running")).toEqual(
      expect.objectContaining({
        status: "interrupted",
        updatedAt: "2026-06-18T00:00:00.000Z"
      })
    );
    expect(subagentRepository.findByAgentId("agent-child-completed")?.status).toBe(
      "completed"
    );
  });

  it("interrupts running subagents after the parent task has completed", async () => {
    const repository = createRepository({ status: "completed" });
    const subagentRepository = createInMemorySubagentRepository([
      createSubagent({ agentId: "agent-child-running", status: "running" }),
      createSubagent({ agentId: "agent-child-completed", status: "completed" })
    ]);
    const runtime = {
      interrupt: vi.fn().mockResolvedValue(true),
      listMessages: vi.fn(),
      start: vi.fn()
    };
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      now: () => new Date("2026-06-18T00:00:00.000Z"),
      repository,
      runtime,
      subagentRepository,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.interruptTask({ taskId: "task-1" })).resolves.toEqual({
      agentId: "agent-child-running",
      status: "interrupted",
      taskId: "task-1"
    });

    expect(runtime.interrupt).toHaveBeenCalledWith("agent-child-running");
    expect(runtime.interrupt).not.toHaveBeenCalledWith("agent-child-completed");
    expect(repository.findTaskById("task-1")?.status).toBe("completed");
    expect(subagentRepository.findByAgentId("agent-child-running")).toEqual(
      expect.objectContaining({
        status: "interrupted",
        updatedAt: "2026-06-18T00:00:00.000Z"
      })
    );
  });

  it("deletes subagent rows and session files with a completed task", async () => {
    const rootPath = await mkdtemp(join(tmpdir(), "hold-rein-subagent-delete-"));
    temporaryPaths.push(rootPath);
    const taskSessionPath = join(rootPath, "task-session.jsonl");
    const childSessionPath = join(rootPath, "child-session.jsonl");
    await writeFile(taskSessionPath, "{}");
    await writeFile(childSessionPath, "{}");
    const repository = createRepository({
      sessionPath: taskSessionPath,
      status: "completed"
    });
    const subagentRepository = createInMemorySubagentRepository([
      createSubagent({
        agentId: "agent-child",
        sessionPath: childSessionPath,
        status: "completed"
      })
    ]);
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime: { interrupt: vi.fn(), listMessages: vi.fn(), start: vi.fn() },
      subagentRepository,
      titleGenerator: { generateTitle: vi.fn() }
    });

    await expect(service.deleteTask({ taskId: "task-1" })).resolves.toEqual({
      status: "deleted",
      taskId: "task-1"
    });

    expect(repository.findTaskById("task-1")).toBeUndefined();
    expect(subagentRepository.findByTaskId("task-1")).toEqual([]);
    await expect(access(taskSessionPath)).rejects.toThrow();
    await expect(access(childSessionPath)).rejects.toThrow();
  });
});

function createRepository(input: {
  sessionPath?: string;
  status: "completed" | "error" | "running";
}) {
  return createInMemoryWorkspaceRepository({
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
        sessionCreatedAt: input.sessionPath ? "now" : null,
        sessionId: input.sessionPath ? "session-task" : null,
        sessionPath: input.sessionPath ?? null,
        status: input.status,
        title: "Task",
        updatedAt: "now",
        workspaceId: "workspace-1"
      }
    ],
    workspaces: [
      {
        createdAt: "now",
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        updatedAt: "now"
      }
    ]
  });
}

function createSubagent(input: {
  agentId: string;
  sessionPath?: string;
  status: "completed" | "interrupted" | "running";
}) {
  return {
    agentId: input.agentId,
    agentName: "subagent",
    createdAt: "now",
    depth: 1,
    parentAgentId: "agent-parent",
    sessionCreatedAt: input.sessionPath ? "now" : null,
    sessionId: input.sessionPath ? `session-${input.agentId}` : null,
    sessionPath: input.sessionPath ?? null,
    status: input.status,
    taskId: "task-1",
    updatedAt: "now"
  };
}
