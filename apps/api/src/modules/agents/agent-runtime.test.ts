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
const harnessOn = vi.fn();
const harnessInterrupt = vi.fn();
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
      subscribe = vi.fn();
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
    harnessOn.mockClear();
    harnessInterrupt.mockClear();
    prompt.mockClear();
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
});

function createRuntime(sessionRepo: JsonlSessionRepoApi) {
  return createAgentRuntime({
    approvalStore: createAgentApprovalStore(),
    eventBus: createAgentEventBus(),
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

  return { create, open, repo };
}
