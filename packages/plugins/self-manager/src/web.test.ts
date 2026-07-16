import type { WebPlugin } from "@hold-rein/plugin-web";
import { describe, expect, it, vi } from "vitest";

import webPlugin from "./web";

describe("self-manager web plugin", () => {
  it("contributes requestSelfApi as a browser runtime tool", async () => {
    const contribution = await resolveContribution();

    expect(contribution.tools).toEqual([
      expect.objectContaining({
        name: "requestSelfApi",
        params: expect.objectContaining({
          required: ["method", "path"],
          type: "object"
        })
      })
    ]);
  });

  it("requests normalized self API paths with query and JSON body", async () => {
    const request = vi.fn().mockResolvedValue({
      code: 0,
      data: { ok: true },
      msg: "success"
    });
    const contribution = await resolveContribution({ request });
    const tool = contribution.tools?.find((item) => item.name === "requestSelfApi");

    const result = await tool?.executor({
      agentId: "agent-1",
      arguments: {
        body: { title: "New title" },
        method: "PATCH",
        path: "/api/v1/agents/tasks/task-1?ignored=true",
        query: { dryRun: false },
      },
      taskId: "task-1",
      toolCallId: "tool-1",
      toolName: "requestSelfApi"
    });

    expect(request).toHaveBeenCalledWith({
      body: JSON.stringify({ title: "New title" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
      path: "/api/v1/agents/tasks/task-1",
      query: { dryRun: false }
    });
    expect(result).toBe(JSON.stringify({
      code: 0,
      data: { ok: true },
      msg: "success"
    }, null, 2));
  });

  it("blocks excluded self API paths", async () => {
    const contribution = await resolveContribution();
    const tool = contribution.tools?.find((item) => item.name === "requestSelfApi");

    await expect(
      tool?.executor({
        agentId: "agent-1",
        arguments: {
          method: "POST",
          path: "/api/v1/agents/tasks/task-1/continue"
        },
        taskId: "task-1",
        toolCallId: "tool-1",
        toolName: "requestSelfApi"
      })
    ).rejects.toThrow("not allowed");
  });

  it("requires self API paths to include the /api/v1 prefix", async () => {
    const contribution = await resolveContribution();
    const tool = contribution.tools?.find((item) => item.name === "requestSelfApi");

    await expect(
      tool?.executor({
        agentId: "agent-1",
        arguments: {
          method: "GET",
          path: "/model-providers"
        },
        taskId: "task-1",
        toolCallId: "tool-1",
        toolName: "requestSelfApi"
      })
    ).rejects.toThrow("/api/v1");
  });
});

async function resolveContribution(
  overrides: Partial<WebPlugin.RuntimeContext> = {}
): Promise<WebPlugin.Contribution> {
  if (!webPlugin.contributionResolver) {
    throw new Error("Expected self-manager contribution resolver");
  }

  const resolver = webPlugin.contributionResolver;
  const context: WebPlugin.RuntimeContext = {
    request: vi.fn().mockResolvedValue({ code: 0, data: null, msg: "success" }),
    subscribeAppUi: vi.fn(),
    ...overrides
  };

  if (typeof resolver !== "function") {
    return resolver;
  }

  return resolver(context);
}
