import { describe, expect, it, vi } from "vitest";

import { createLoopbackHostApiClient } from ".";

describe("createLoopbackHostApiClient", () => {
  it("starts an agent against the configured host API", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: 0,
        data: {
          agentId: "agent-1",
          sessionId: "session-1",
          status: "running",
          task: { id: "task-1" },
          workspace: { id: "workspace-1" }
        },
        msg: "success"
      }))
    );
    const hostApi = createLoopbackHostApiClient({
      baseUrl: "http://127.0.0.1:3001/",
      fetch
    });

    const result = await hostApi.agent.start({
      modelId: "gpt-4.1",
      prompt: "Inspect this project",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });

    expect(result).toEqual({
      code: 0,
      data: {
        agentId: "agent-1",
        sessionId: "session-1",
        status: "running",
        task: { id: "task-1" },
        workspace: { id: "workspace-1" }
      },
      msg: "success"
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/agents/start",
      {
        body: JSON.stringify({
          modelId: "gpt-4.1",
          prompt: "Inspect this project",
          provider: "openai",
          workspacePath: "/tmp/workspace"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
  });
});
