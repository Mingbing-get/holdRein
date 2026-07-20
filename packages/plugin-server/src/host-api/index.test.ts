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

  it("wraps agent task and skill endpoints", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({
        code: 0,
        data: { ok: true },
        msg: "success"
      }))
    ));
    const hostApi = createLoopbackHostApiClient({
      baseUrl: "http://127.0.0.1:3001/",
      fetch
    });

    await hostApi.agent.listSkills({ workspacePath: "/tmp/workspace" });
    await hostApi.agent.listTaskMessages({ taskId: "task/one" });
    await hostApi.agent.continueTask({
      modelId: "gpt-4.1",
      prompt: "Keep going",
      provider: "openai",
      taskId: "task/one"
    });
    await hostApi.agent.interruptTask({ taskId: "task/one" });
    await hostApi.agent.renameTask({ taskId: "task/one", title: "New title" });
    await hostApi.agent.deleteTask({ taskId: "task/one" });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3001/api/v1/agents/skills?workspacePath=%2Ftmp%2Fworkspace",
      { method: "GET" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/v1/agents/tasks/task%2Fone/messages",
      { method: "GET" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:3001/api/v1/agents/tasks/task%2Fone/continue",
      {
        body: JSON.stringify({
          modelId: "gpt-4.1",
          prompt: "Keep going",
          provider: "openai"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:3001/api/v1/agents/tasks/task%2Fone/interrupt",
      { method: "POST" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:3001/api/v1/agents/tasks/task%2Fone",
      {
        body: JSON.stringify({ title: "New title" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:3001/api/v1/agents/tasks/task%2Fone",
      { method: "DELETE" }
    );
  });
});
