import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../../app";
import type { AgentsService } from "../service";

function createService(): AgentsService {
  return {
    approveAgentAction: vi.fn(),
    continueTask: vi.fn().mockResolvedValue({
      agentId: "agent-2",
      sessionId: "session-2",
      status: "running",
      task: { id: "task-1" },
      workspace: { id: "workspace-1" }
    }),
    deleteTask: vi.fn(),
    getTaskTitle: vi.fn(),
    interruptTask: vi.fn(),
    listTaskMessages: vi.fn(),
    renameTask: vi.fn(),
    startAgent: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      sessionId: "session-1",
      status: "running",
      task: { id: "task-1" },
      workspace: { id: "workspace-1" }
    }),
    subscribeToAgentEvents: vi.fn()
  };
}

const runtimeContributions = {
  skills: [{ content: "# Browser Context", name: "browser-context" }],
  systemPrompts: ["Prefer browser tools for live page context."],
  tools: [{ inputSchema: { type: "object" }, name: "read_browser_selection" }]
};

describe("agent runtime contribution routes", () => {
  it("passes browser runtime contributions to start requests", async () => {
    const service = createService();

    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/start")
      .send({
        modelId: "gpt-4.1",
        prompt: "Inspect this project",
        provider: "openai",
        runtimeContributions,
        workspacePath: "/tmp/workspace"
      });

    expect(response.status).toBe(200);
    expect(service.startAgent).toHaveBeenCalledWith({
      approvalPolicy: "approval",
      modelId: "gpt-4.1",
      prompt: "Inspect this project",
      provider: "openai",
      runtimeContributions,
      thinkingLevel: "medium",
      workspacePath: "/tmp/workspace"
    });
  });

  it("passes browser runtime contributions to continue requests", async () => {
    const service = createService();

    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/continue")
      .send({
        modelId: "gpt-4.1",
        prompt: "Continue",
        provider: "openai",
        runtimeContributions
      });

    expect(response.status).toBe(200);
    expect(service.continueTask).toHaveBeenCalledWith({
      approvalPolicy: "approval",
      modelId: "gpt-4.1",
      prompt: "Continue",
      provider: "openai",
      runtimeContributions,
      taskId: "task-1",
      thinkingLevel: "medium"
    });
  });
});
