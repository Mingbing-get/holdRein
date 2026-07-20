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

  it("wraps model provider and proxy endpoints", async () => {
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

    await hostApi.modelProviders.list();
    await hostApi.modelProviders.createCustom({
      baseUrl: "https://api.example.test/v1",
      provider: "acme"
    });
    await hostApi.modelProviders.updateCustom({
      baseUrl: "https://api2.example.test/v1",
      currentProvider: "acme/old",
      provider: "acme"
    });
    await hostApi.modelProviders.deleteCustom({ provider: "acme/old" });
    await hostApi.modelProviders.listModels({ provider: "acme/provider" });
    await hostApi.modelProviders.createModel({
      api: "responses",
      contextWindow: 128000,
      input: ["text", "image"],
      maxTokens: 8192,
      modelId: "acme-chat",
      name: "Acme Chat",
      provider: "acme/provider",
      reasoning: true
    });
    await hostApi.modelProviders.updateModel({
      api: "responses",
      contextWindow: 64000,
      input: ["text"],
      maxTokens: 4096,
      modelId: "acme/chat",
      name: "Acme Chat 2",
      provider: "acme/provider",
      reasoning: false
    });
    await hostApi.modelProviders.deleteModel({
      modelId: "acme/chat",
      provider: "acme/provider"
    });
    await hostApi.modelProviders.storeApiKey({
      apiKey: "test-key",
      provider: "acme/provider"
    });
    await hostApi.modelProxies.list();
    await hostApi.modelProxies.create({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "day" }],
          modelId: "gpt-4.1",
          priority: 0,
          provider: "openai"
        }
      ],
      modelId: "local-coding",
      name: "Local Coding"
    });
    await hostApi.modelProxies.get({ modelId: "local/coding" });
    await hostApi.modelProxies.update({
      candidates: [
        {
          limits: [{ maxTokens: 100, windowHours: 4, windowType: "hours" }],
          modelId: "gpt-4.1-mini",
          priority: 1,
          provider: "openai"
        }
      ],
      currentModelId: "local/coding",
      modelId: "local-coding",
      name: "Local Coding"
    });
    await hostApi.modelProxies.delete({ modelId: "local/coding" });

    expect(fetch.mock.calls.map(([url, init]) => [url, init])).toMatchObject([
      ["http://127.0.0.1:3001/api/v1/model-providers", { method: "GET" }],
      ["http://127.0.0.1:3001/api/v1/model-providers/custom", { method: "POST" }],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/custom/acme%2Fold",
        { method: "PUT" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/custom/acme%2Fold",
        { method: "DELETE" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/acme%2Fprovider/models",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/acme%2Fprovider/models",
        { method: "POST" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/acme%2Fprovider/models/acme%2Fchat",
        { method: "PUT" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/acme%2Fprovider/models/acme%2Fchat",
        { method: "DELETE" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-providers/acme%2Fprovider/api-key",
        { method: "PUT" }
      ],
      ["http://127.0.0.1:3001/api/v1/model-proxies", { method: "GET" }],
      ["http://127.0.0.1:3001/api/v1/model-proxies", { method: "POST" }],
      [
        "http://127.0.0.1:3001/api/v1/model-proxies/local%2Fcoding",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-proxies/local%2Fcoding",
        { method: "PUT" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/model-proxies/local%2Fcoding",
        { method: "DELETE" }
      ]
    ]);
    expect(JSON.parse(fetch.mock.calls[6][1].body as string)).toEqual({
      api: "responses",
      contextWindow: 64000,
      input: ["text"],
      maxTokens: 4096,
      name: "Acme Chat 2",
      reasoning: false
    });
  });

  it("wraps scheduled task endpoints", async () => {
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
    const input = {
      allowConcurrentRuns: false,
      cronExpression: "0 9 * * *",
      enabled: true,
      modelId: "gpt-4.1",
      name: "Daily check",
      prompt: "Check status",
      provider: "openai",
      thinkingLevel: "medium" as const,
      timezone: "Asia/Shanghai",
      workspacePath: "/tmp/workspace"
    };

    await hostApi.scheduledTasks.list({ workspacePath: "/tmp/work space" });
    await hostApi.scheduledTasks.create(input);
    await hostApi.scheduledTasks.get({ id: "scheduled/1" });
    await hostApi.scheduledTasks.update({
      id: "scheduled/1",
      name: "Updated"
    });
    await hostApi.scheduledTasks.enable({ id: "scheduled/1" });
    await hostApi.scheduledTasks.disable({ id: "scheduled/1" });
    await hostApi.scheduledTasks.delete({ id: "scheduled/1" });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks?workspacePath=%2Ftmp%2Fwork+space",
      { method: "GET" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks",
      {
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks/scheduled%2F1",
      { method: "GET" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks/scheduled%2F1",
      {
        body: JSON.stringify({ name: "Updated" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      5,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks/scheduled%2F1/enable",
      { method: "POST" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      6,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks/scheduled%2F1/disable",
      { method: "POST" }
    );
    expect(fetch).toHaveBeenNthCalledWith(
      7,
      "http://127.0.0.1:3001/api/v1/scheduled-tasks/scheduled%2F1",
      { method: "DELETE" }
    );
  });

  it("wraps usage stats, workspace, plugin, and skill list endpoints", async () => {
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

    await hostApi.usageStats.getModelUsage({ range: "30d" });
    await hostApi.usageStats.getTaskUsage({ groupBy: "workspace", range: "7d" });
    await hostApi.workspaces.listRecentTasks();
    await hostApi.workspaces.delete({ workspaceId: "workspace/1" });
    await hostApi.workspaces.getSetting({ workspaceId: "workspace/1" });
    await hostApi.workspaces.updateSetting({
      activePlugins: ["demo"],
      activeSkills: null,
      workspaceId: "workspace/1"
    });
    await hostApi.workspaces.listTasks({
      afterLastContinuedAt: "2026-06-08T08:00:00.000Z",
      limit: 20,
      workspaceId: "workspace/1"
    });
    await hostApi.plugins.list();
    await hostApi.skills.list();

    expect(fetch.mock.calls.map(([url, init]) => [url, init])).toEqual([
      [
        "http://127.0.0.1:3001/api/v1/usage-stats/models?range=30d",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/usage-stats/tasks?range=7d&groupBy=workspace",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/workspaces/recent-tasks",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/workspaces/workspace%2F1",
        { method: "DELETE" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/workspaces/workspace%2F1/setting",
        { method: "GET" }
      ],
      [
        "http://127.0.0.1:3001/api/v1/workspaces/workspace%2F1/setting",
        {
          body: JSON.stringify({
            activePlugins: ["demo"],
            activeSkills: null
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      ],
      [
        "http://127.0.0.1:3001/api/v1/workspaces/workspace%2F1/tasks?afterLastContinuedAt=2026-06-08T08%3A00%3A00.000Z&limit=20",
        { method: "GET" }
      ],
      ["http://127.0.0.1:3001/api/v1/plugins", { method: "GET" }],
      ["http://127.0.0.1:3001/api/v1/skills", { method: "GET" }]
    ]);
  });
});
