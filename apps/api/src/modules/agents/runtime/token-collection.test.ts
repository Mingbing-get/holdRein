import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import {
  createContribution,
  createRunInput,
  createRuntime,
  createSessionRepo,
  getHarnessTool,
  subagentInput
} from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
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
      interrupt = vi.fn();
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
    NodeExecutionEnv: class {
      constructor(readonly options: unknown) {}
    },
    loadSkills: vi.fn().mockResolvedValue({ diagnostics: [], skills: [] })
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime token collection", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessOn.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue(createContribution());
  });

  it("collects input and output tokens for a task across active harnesses", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    const result = await runtime.start(createRunInput());
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    await subagentTool?.execute?.("tool-call-1", subagentInput());

    await harnessSubscribers[0]?.({
      message: assistantMessage({ input: 11, output: 5 }),
      type: "message_end"
    });
    await harnessSubscribers[2]?.({
      message: assistantMessage({ input: 7, output: 3 }),
      type: "message_end"
    });
    await harnessSubscribers[2]?.({ type: "agent_end" });
    await harnessSubscribers[2]?.({
      message: assistantMessage({ input: 100, output: 100 }),
      type: "message_end"
    });

    expect(runtime.getTokenUsage?.("task-1")).toEqual({
      inputToken: 18,
      outputToken: 8,
      taskId: "task-1"
    });
    expect(result.agentId).toMatch(/^agent_/);
  });

  it("throttles database token usage writes and flushes the final delta", async () => {
    vi.useFakeTimers();
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const addTaskTokenUsage = vi.fn();
    const runtime = createRuntime(
      repo,
      eventBus,
      subagentRepository,
      undefined,
      {
        addTaskTokenUsage,
        tokenFlushIntervalMs: 1000
      }
    );
    await runtime.start(createRunInput());

    await harnessSubscribers[0]?.({
      message: assistantMessage({ input: 11, output: 5 }),
      type: "message_end"
    });
    await harnessSubscribers[0]?.({
      message: assistantMessage({ input: 7, output: 3 }),
      type: "message_end"
    });

    expect(addTaskTokenUsage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(999);
    expect(addTaskTokenUsage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(addTaskTokenUsage).toHaveBeenCalledTimes(1);
    expect(addTaskTokenUsage).toHaveBeenLastCalledWith("task-1", {
      inputToken: 18,
      outputToken: 8
    });

    await harnessSubscribers[0]?.({
      message: assistantMessage({ input: 2, output: 1 }),
      type: "message_end"
    });
    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(addTaskTokenUsage).toHaveBeenCalledTimes(2);
    expect(addTaskTokenUsage).toHaveBeenLastCalledWith("task-1", {
      inputToken: 2,
      outputToken: 1
    });

    vi.useRealTimers();
  });
});

function assistantMessage(usage: {
  input: number;
  output: number;
}): AgentMessage {
  return {
    api: "openai-responses",
    content: [{ text: "Done", type: "text" }],
    model: "gpt-4.1",
    provider: "openai",
    role: "assistant",
    stopReason: "stop",
    timestamp: Date.now(),
    usage: {
      cacheRead: 0,
      cacheWrite: 0,
      cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
      input: usage.input,
      output: usage.output,
      totalTokens: usage.input + usage.output
    }
  } as AgentMessage;
}
