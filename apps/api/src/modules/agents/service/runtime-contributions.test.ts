import { describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentsService } from ".";

const runtimeContributions = {
  systemPrompts: ["Request scoped instruction"],
  tools: [{ inputSchema: { type: "object" }, name: "read_browser_selection" }]
};

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
});

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
