import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentsService } from ".";

const runtimeContributions = {
  systemPrompts: ["Request scoped instruction"],
  tools: [{ inputSchema: { type: "object" }, name: "read_browser_selection" }]
};

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true }))
  );
});

describe("agents service runtime contributions", () => {
  it("forwards runtime contributions when starting a task", async () => {
    const runtime = createRuntime();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository: createInMemoryWorkspaceRepository(),
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Inspect") }
    });

    await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      runtimeContributions,
      workspacePath: "/tmp/workspace"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeContributions })
    );
  });

  it("forwards active capabilities when starting a task", async () => {
    const runtime = createRuntime();
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository: createInMemoryWorkspaceRepository(),
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Inspect") }
    });

    await service.startAgent({
      activePlugins: ["demo-plugin"],
      activeSkills: ["demo-skill"],
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        activePlugins: ["demo-plugin"],
        activeSkills: ["demo-skill"]
      })
    );
  });

  it("loads active capabilities from the workspace setting when starting a task", async () => {
    const runtime = createRuntime();
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["workspace-plugin"],
      activeSkills: ["workspace-skill"]
    });
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository: createInMemoryWorkspaceRepository(),
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Inspect") }
    });

    await service.startAgent({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        activePlugins: ["workspace-plugin"],
        activeSkills: ["workspace-skill"]
      })
    );
  });

  it("intersects request and workspace active capabilities when starting a task", async () => {
    const runtime = createRuntime();
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["plugin-b", "plugin-c"],
      activeSkills: ["skill-b", "skill-c"]
    });
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository: createInMemoryWorkspaceRepository(),
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Inspect") }
    });

    await service.startAgent({
      activePlugins: ["plugin-a", "plugin-b"],
      activeSkills: ["skill-a", "skill-b"],
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        activePlugins: ["plugin-b"],
        activeSkills: ["skill-b"]
      })
    );
  });

  it("forwards runtime contributions when continuing a task", async () => {
    const runtime = createRuntime();
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          approvalPolicy: "approval",
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
          thinkingLevel: "medium",
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
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Continue") }
    });

    await service.continueTask({
      prompt: "Continue",
      runtimeContributions,
      taskId: "task-1"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeContributions })
    );
  });

  it("loads active capabilities from the workspace setting when continuing a task", async () => {
    const runtime = createRuntime();
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["workspace-plugin"],
      activeSkills: ["workspace-skill"]
    });
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          approvalPolicy: "approval",
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
          thinkingLevel: "medium",
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
          path: workspacePath,
          updatedAt: "now"
        }
      ]
    });
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Continue") }
    });

    await service.continueTask({
      prompt: "Continue",
      taskId: "task-1"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        activePlugins: ["workspace-plugin"],
        activeSkills: ["workspace-skill"]
      })
    );
  });

  it("intersects request and workspace active capabilities when continuing a task", async () => {
    const runtime = createRuntime();
    const workspacePath = await createWorkspaceSetting({
      activePlugins: ["plugin-b", "plugin-c"],
      activeSkills: ["skill-b", "skill-c"]
    });
    const repository = createInMemoryWorkspaceRepository({
      tasks: [
        {
          approvalPolicy: "approval",
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
          thinkingLevel: "medium",
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
          path: workspacePath,
          updatedAt: "now"
        }
      ]
    });
    const service = createAgentsService({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      repository,
      runtime,
      titleGenerator: { generateTitle: vi.fn().mockResolvedValue("Continue") }
    });

    await service.continueTask({
      activePlugins: ["plugin-a", "plugin-b"],
      activeSkills: ["skill-a", "skill-b"],
      prompt: "Continue",
      taskId: "task-1"
    });

    expect(runtime.start).toHaveBeenCalledWith(
      expect.objectContaining({
        activePlugins: ["plugin-b"],
        activeSkills: ["skill-b"]
      })
    );
  });
});

async function createWorkspaceSetting(setting: unknown): Promise<string> {
  const workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-workspace-"));
  temporaryPaths.push(workspacePath);
  const settingDirectory = join(workspacePath, ".hold-rein");
  await mkdir(settingDirectory);
  await writeFile(
    join(settingDirectory, "setting.json"),
    JSON.stringify(setting)
  );

  return workspacePath;
}

function createRuntime() {
  return {
    interrupt: vi.fn(),
    listMessages: vi.fn(),
    start: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      session: {
        createdAt: "2026-06-25T00:00:00.000Z",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      },
      status: "running"
    })
  };
}
