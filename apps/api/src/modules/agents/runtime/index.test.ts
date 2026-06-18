import { Type } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { SESSIONS_DIR } from "../../../config/const";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentRuntime } from ".";
import { createInMemorySubagentRepository } from "../subagent/repository";
import {
  createContribution,
  createRunInput,
  createRuntime,
  createSessionRepo,
  getHarnessTool as findHarnessTool,
  subagentDetails,
  subagentInput,
  toolResultMessage
} from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const sessionRepoConstructor = vi.fn();
const executionEnvConstructor = vi.fn();
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
const harnessInterrupt = vi.fn();
const harnessSubscribers: ((event: { message?: unknown; type: string }) => unknown)[] = [];
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
    resolveContributions.mockResolvedValue(createContribution());
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
      expect.objectContaining({ content: "Saved prompt for session-1", role: "user" })
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
    resolveContributions.mockResolvedValue(createContribution({
      tools: [
        {
          description: "Apply the requested workspace change",
          execute: vi.fn(),
          label: "Workspace Patch",
          name: "workspace_patch",
          parameters: Type.Object({}),
          beforeExecute: ({ requestApproval }: ServerPlugin.ToolBeforeExecuteOptions) =>
            requestApproval("允许插件修改工作区？")
        }
      ]
    }));
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
    resolveContributions.mockResolvedValue(createContribution({
      onAgentEnd: vi.fn().mockResolvedValue({
        details: { source: "test-plugin" },
        prompt: "Check whether another step is needed"
      })
    }));
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
      .mockResolvedValueOnce(createContribution({
        onAgentEnd: vi.fn().mockResolvedValue({
          prompt: "Use the plugin-selected follow-up prompt"
        }),
        systemPrompts: ["first plugin prompt"]
      }))
      .mockResolvedValueOnce(createContribution({
        systemPrompts: ["second plugin prompt"]
      }));
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

  it("starts a subagent tool and records immutable call metadata without status", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const childRowsAtPrompt: unknown[] = [];
    prompt.mockImplementation(async () => {
      if (prompt.mock.calls.length === 2) {
        childRowsAtPrompt.push(subagentRepository.findByTaskId("task-1")[0]);
      }
    });
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    const result = await runtime.start(createRunInput());
    const callMessages: { role: unknown; type: string }[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type !== "message_start" && event.type !== "message_end") return;
      const payload = event.payload as { message: { role?: unknown } };
      callMessages.push({ role: payload.message.role, type: event.type });
    });
    const subagentTool = findHarnessTool(harnessConstructor, "call_subagent");

    await expect(
      subagentTool?.execute?.("tool-call-1", subagentInput())
    ).resolves.toEqual({
      content: [{
        text: expect.stringContaining('Subagent "researcher" is running'),
        type: "text"
      }],
      details: expect.objectContaining({
        agentName: "researcher",
        parentAgentId: result.agentId,
        taskId: "task-1"
      })
    });
    await subagentTool?.execute?.("tool-call-2", {
      agentName: "reviewer",
      prompt: "Review the auth module"
    });

    expect(prompt).toHaveBeenNthCalledWith(2, "Inspect the auth module");
    const childRows = subagentRepository.findByTaskId("task-1");
    expect(childRows[0]).toEqual(
      expect.objectContaining({
        sessionCreatedAt: "2026-06-11T00:00:00.000Z",
        sessionId: "session-2",
        sessionPath: "/sessions/session-2.jsonl"
      })
    );
    expect(childRowsAtPrompt[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-2"
      })
    );
    expect(appendCustomMessageEntry).not.toHaveBeenCalled();
    expect(callMessages).toEqual([]);

    const secondResult = toolResultMessage("tool-call-2");
    await harnessSubscribers[0]?.({ message: secondResult, type: "message_start" });
    await harnessSubscribers[0]?.({ message: secondResult, type: "message_end" });
    const firstResult = toolResultMessage("tool-call-1");
    await harnessSubscribers[0]?.({ message: firstResult, type: "message_start" });
    await harnessSubscribers[0]?.({ message: firstResult, type: "message_end" });

    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "callsubagent",
      'Subagent "researcher" is running.',
      true,
      expect.not.objectContaining({ status: expect.anything() })
    );
    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "callsubagent",
      'Subagent "researcher" is running.',
      true,
      expect.objectContaining(subagentDetails(result.agentId))
    );
    expect(callMessages).toEqual([
      { role: "toolResult", type: "message_start" },
      { role: "toolResult", type: "message_end" },
      { role: "custom", type: "message_start" },
      { role: "toolResult", type: "message_start" },
      { role: "toolResult", type: "message_end" },
      { role: "custom", type: "message_start" }
    ]);
    expect(appendCustomMessageEntry.mock.calls.map((call) => call[1])).toEqual([
      'Subagent "reviewer" is running.',
      'Subagent "researcher" is running.'
    ]);
  });

  it("removes the persisted running row when subagent startup fails", async () => {
    const { repo } = createSessionRepo();
    const subagentRepository = createInMemorySubagentRepository();
    const deleteSubagent = vi.spyOn(subagentRepository, "delete");
    const runtime = createRuntime(repo, createAgentEventBus(), subagentRepository);
    await runtime.start(createRunInput());
    resolveContributions.mockRejectedValueOnce(new Error("Child setup failed"));
    const subagentTool = findHarnessTool(harnessConstructor, "call_subagent");

    await expect(subagentTool?.execute?.("tool-call-1", subagentInput()))
      .rejects.toThrow("Child setup failed");

    expect(deleteSubagent).toHaveBeenCalledOnce();
    expect(subagentRepository.findByAgentId(deleteSubagent.mock.calls[0]?.[0] ?? ""))
      .toBeUndefined();
  });

  it("continues the parent harness with a subagent result before ending the task", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const childOnAgentEnd = vi.fn().mockResolvedValue({ prompt: "Continue child" });
    const subagentRepository = createInMemorySubagentRepository();
    resolveContributions
      .mockResolvedValueOnce(createContribution())
      .mockResolvedValueOnce(createContribution({ onAgentEnd: childOnAgentEnd }));
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    const result = await runtime.start(createRunInput());
    const subagentTool = findHarnessTool(harnessConstructor, "call_subagent");
    const callResult = await subagentTool?.execute?.("tool-call-1", subagentInput()) as
      { details?: { agentId?: string } } | undefined;
    const childAgentId = callResult?.details?.agentId;
    const eventTypes: string[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => eventTypes.push(event.type));
    await harnessSubscribers[0]?.({ type: "agent_end" });
    expect(eventTypes).not.toContain("task_end");
    expect(subagentRepository.findByAgentId(childAgentId ?? "")?.status).toBe("running");
    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "The auth module is isolated.", type: "text" }],
        role: "assistant",
        timestamp: 2
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });
    expect(childAgentId).toMatch(/^agent_/);
    expect(childOnAgentEnd).toHaveBeenCalledWith(expect.objectContaining({
      messages: [expect.objectContaining({ content: "Saved prompt for session-2" })],
      runInput: expect.objectContaining({ session: expect.objectContaining({ id: "session-2" }) }),
      session: expect.objectContaining({ id: "session-2" })
    }));
    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      "subagent_result", expect.anything(), true, expect.anything()
    );
    expect(subagentRepository.findByAgentId(childAgentId ?? "")?.status).toBe("running");
    await harnessSubscribers[2]?.({ type: "agent_end" });
    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "subagent_result",
      expect.stringContaining("researcher"),
      true,
      expect.objectContaining({ agentId: childAgentId, agentName: "researcher" })
    );
    expect(prompt).toHaveBeenNthCalledWith(3, "");
    expect(prompt).toHaveBeenNthCalledWith(4, "");
    expect(subagentRepository.findByAgentId(childAgentId ?? "")?.status).toBe("completed");
    await harnessSubscribers[2]?.({ type: "agent_end" });
    expect(prompt).toHaveBeenCalledTimes(4);
  });
});
