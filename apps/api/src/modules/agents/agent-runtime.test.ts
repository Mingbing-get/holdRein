import type {
  JsonlSessionMetadata,
  JsonlSessionRepoApi,
  Session
} from "@earendil-works/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { SESSIONS_DIR } from "../../config/const";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentRuntime } from "./agent-runtime";

const prompt = vi.fn().mockResolvedValue(undefined);
const sessionRepoConstructor = vi.fn();
const executionEnvConstructor = vi.fn();
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
const harnessInterrupt = vi.fn();
const harnessSubscribers: ((event: { type: string }) => unknown)[] = [];
const resolveContributions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    skillDirs: [],
    skills: [],
    systemPrompts: [],
    tools: []
  })
);

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      interrupt = harnessInterrupt;
      on = harnessOn;
      prompt = prompt;
      subscribe = vi.fn((listener: (event: { type: string }) => unknown) => {
        harnessSubscribers.push(listener);
        return vi.fn();
      });

      constructor(options: unknown) {
        harnessConstructor(options);
      }
    },
    JsonlSessionRepo: class {
      readonly options: unknown;

      constructor(options: unknown) {
        this.options = options;
        sessionRepoConstructor(options);
      }
    },
    NodeExecutionEnv: class {
      readonly options: unknown;

      constructor(options: unknown) {
        this.options = options;
        executionEnvConstructor(options);
      }
    },
    loadSkills: vi.fn().mockResolvedValue({ diagnostics: [], skills: [] })
  };
});

vi.mock("../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime sessions", () => {
  beforeEach(() => {
    executionEnvConstructor.mockClear();
    harnessConstructor.mockClear();
    harnessOn.mockClear();
    harnessInterrupt.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue({
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: []
    });
    sessionRepoConstructor.mockClear();
  });

  it("configures default session storage with the central sessions directory", () => {
    createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus()
    });

    expect(executionEnvConstructor).toHaveBeenCalledWith({ cwd: SESSIONS_DIR });
    expect(sessionRepoConstructor).toHaveBeenCalledWith({
      fs: expect.anything(),
      sessionsRoot: SESSIONS_DIR
    });
  });

  it("creates a session for a new task", async () => {
    const { repo, create, open } = createSessionRepo();
    const runtime = createRuntime(repo);

    const result = await runtime.start(createRunInput());

    expect(create).toHaveBeenCalledWith({ cwd: "/tmp/workspace" });
    expect(open).not.toHaveBeenCalled();
    expect(result.session).toEqual({
      createdAt: "2026-06-11T00:00:00.000Z",
      id: "session-1",
      path: "/sessions/session-1.jsonl"
    });
  });

  it("opens the stored session when continuing a task", async () => {
    const { repo, create, open } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({
      ...createRunInput(),
      session: {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      }
    });

    expect(open).toHaveBeenCalledWith({
      createdAt: "2026-06-11T00:00:00.000Z",
      cwd: "/tmp/workspace",
      id: "session-1",
      path: "/sessions/session-1.jsonl"
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("includes the workspace path and current time in the system prompt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T09:30:00.000Z"));
    try {
      const { repo } = createSessionRepo();
      const runtime = createRuntime(repo);

      await runtime.start(createRunInput());

      const systemPrompt = harnessConstructor.mock.calls[0]?.[0]
        ?.systemPrompt as
        | ((input: { resources: { skills: unknown[] } }) => string)
        | undefined;
      const promptText = systemPrompt?.({ resources: { skills: [] } });
      expect(promptText).toContain("Workspace: /tmp/workspace");
      expect(promptText).toContain("Current time: 2026-06-17T09:30:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads messages from an opened session", async () => {
    const { repo, open } = createSessionRepo();
    const runtime = createRuntime(repo);

    const messages = await runtime.listMessages({
      session: {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      },
      workspacePath: "/tmp/workspace"
    });

    expect(open).toHaveBeenCalledOnce();
    expect(messages).toEqual([
      expect.objectContaining({ content: "Saved prompt", role: "user" })
    ]);
  });

  it("interrupts a running harness by agent id", async () => {
    prompt.mockReturnValue(new Promise(() => undefined));
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);
    const result = await runtime.start(createRunInput());

    await expect(runtime.interrupt(result.agentId)).resolves.toBe(true);

    expect(harnessInterrupt).toHaveBeenCalledOnce();
    await expect(runtime.interrupt(result.agentId)).resolves.toBe(false);
  });

  it("requests a generic plugin tool approval with optional title", async () => {
    const approvalStore = createAgentApprovalStore();
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    resolveContributions.mockResolvedValue({
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: [
        {
          description: "Apply the requested workspace change",
          execute: vi.fn(),
          name: "workspace_patch",
          beforeExecute: ({ requestApproval }: ServerPlugin.ToolBeforeExecuteOptions) =>
            requestApproval("允许插件修改工作区？")
        }
      ]
    });
    const runtime = createAgentRuntime({
      approvalStore,
      eventBus,
      sessionRepo: repo
    });

    const result = await runtime.start(createRunInput());
    let approvalId = "";
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type === "approval_requested") {
        approvalId = (event.payload as { approvalId: string }).approvalId;
      }
    });
    const toolCallHandler = harnessOn.mock.calls.find(
      ([eventName]) => eventName === "tool_call"
    )?.[1] as ((event: unknown) => Promise<unknown>) | undefined;
    const decision = toolCallHandler?.({
      input: { file: "src/index.ts" },
      toolCallId: "tool-call-1",
      toolName: "workspace_patch"
    });

    expect(approvalId).not.toBe("");

    expect(
      approvalStore.decide({
        agentId: result.agentId,
        approvalId,
        approved: false,
        reason: "Keep generated output for inspection"
      })
    ).toBe(true);
    await expect(decision).resolves.toEqual({
      block: true,
      reason: "Keep generated output for inspection"
    });
  });

  it("emits task_end when no plugin continues after an agent run ends", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus,
      sessionRepo: repo
    });
    const result = await runtime.start(createRunInput());
    const eventTypes: string[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      eventTypes.push(event.type);
    });

    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(eventTypes).toEqual(["agent_end", "task_end"]);
  });

  it("appends plugin continuation as a visible custom message and starts the next harness with an empty prompt", async () => {
    const { appendCustomMessageEntry, create, open, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    resolveContributions.mockResolvedValue({
      onAgentEnd: vi.fn().mockResolvedValue({
        details: { source: "test-plugin" },
        prompt: "Check whether another step is needed"
      }),
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: []
    });
    const runtime = createRuntime(repo, eventBus);

    const result = await runtime.start(createRunInput());
    const messages: unknown[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type === "message_start") {
        messages.push(event.payload);
      }
    });
    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "agent_continuation",
      "Check whether another step is needed",
      true,
      { source: "test-plugin" }
    );
    expect(prompt).toHaveBeenNthCalledWith(2, "");
    expect(create).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    expect(messages).toEqual([
      {
        message: expect.objectContaining({
          content: "Check whether another step is needed",
          customType: "agent_continuation",
          display: true,
          role: "custom"
        })
      }
    ]);
  });

  it("resolves fresh plugin contributions for continuation harnesses with the continuation prompt", async () => {
    const { repo } = createSessionRepo();
    resolveContributions
      .mockResolvedValueOnce({
        onAgentEnd: vi.fn().mockResolvedValue({
          prompt: "Use the plugin-selected follow-up prompt"
        }),
        skillDirs: [],
        skills: [],
        systemPrompts: ["first plugin prompt"],
        tools: []
      })
      .mockResolvedValueOnce({
        skillDirs: [],
        skills: [],
        systemPrompts: ["second plugin prompt"],
        tools: []
      });
    const runtime = createRuntime(repo);

    await runtime.start(createRunInput());
    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(resolveContributions).toHaveBeenCalledTimes(2);
    expect(resolveContributions.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        agentName: "main",
        isContinue: true,
        prompt: "Use the plugin-selected follow-up prompt"
      })
    );
    const systemPrompt = harnessConstructor.mock.calls[1]?.[0]
      ?.systemPrompt as
      | ((input: { resources: { skills: unknown[] } }) => string)
      | undefined;
    expect(systemPrompt?.({ resources: { skills: [] } })).toContain(
      "second plugin prompt"
    );
    expect(prompt).toHaveBeenNthCalledWith(2, "");
  });

  it("resolves initial plugin contributions for the main agent as a non-continuation run", async () => {
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start(createRunInput());

    expect(resolveContributions).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: "main",
        isContinue: false,
        prompt: "Continue"
      })
    );
  });
});

function createRuntime(
  sessionRepo: JsonlSessionRepoApi,
  eventBus = createAgentEventBus()
) {
  return createAgentRuntime({
    approvalStore: createAgentApprovalStore(),
    eventBus,
    sessionRepo
  });
}

function createRunInput() {
  return {
    modelId: "gpt-4.1",
    prompt: "Continue",
    provider: "openai",
    taskId: "task-1",
    workspacePath: "/tmp/workspace"
  };
}

function createSessionRepo() {
  const metadata: JsonlSessionMetadata = {
    createdAt: "2026-06-11T00:00:00.000Z",
    cwd: "/tmp/workspace",
    id: "session-1",
    path: "/sessions/session-1.jsonl"
  };
  const session = {
    appendCustomMessageEntry: vi.fn(),
    buildContext: vi.fn().mockResolvedValue({
      messages: [{ content: "Saved prompt", role: "user", timestamp: 1 }],
      model: null,
      thinkingLevel: "off"
    }),
    getMetadata: vi.fn().mockResolvedValue(metadata)
  } as unknown as Session<JsonlSessionMetadata>;
  const create = vi.fn().mockResolvedValue(session);
  const open = vi.fn().mockResolvedValue(session);
  const repo = {
    create,
    delete: vi.fn(),
    fork: vi.fn(),
    list: vi.fn(),
    open
  } as unknown as JsonlSessionRepoApi;

  return { appendCustomMessageEntry: session.appendCustomMessageEntry, create, open, repo };
}
