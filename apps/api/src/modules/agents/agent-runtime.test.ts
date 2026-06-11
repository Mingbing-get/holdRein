import type {
  JsonlSessionMetadata,
  JsonlSessionRepoApi,
  Session
} from "@earendil-works/pi-agent-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SESSIONS_DIR } from "../../config/const";
import { createAgentApprovalStore } from "./agent-approval-store";
import { createAgentEventBus } from "./agent-event-bus";
import { createAgentRuntime } from "./agent-runtime";

const prompt = vi.fn().mockResolvedValue(undefined);
const sessionRepoConstructor = vi.fn();
const executionEnvConstructor = vi.fn();

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      on = vi.fn();
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

describe("agent runtime sessions", () => {
  beforeEach(() => {
    executionEnvConstructor.mockClear();
    prompt.mockClear();
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
