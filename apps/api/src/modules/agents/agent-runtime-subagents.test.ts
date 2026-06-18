import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentEventBus } from "./agent-event-bus";
import { createInMemorySubagentRepository } from "./subagent-repository";
import {
  createContribution,
  createRunInput,
  createRuntime,
  createSessionRepo,
  getHarnessTool,
  subagentInput,
  toolResultMessage
} from "./agent-runtime-test-utils";

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

vi.mock("../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime subagent calls", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessOn.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue(createContribution());
  });

  it("appends one visible start message per subagent in a batch call", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    const result = await runtime.start(createRunInput());
    const callMessages: string[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type !== "message_start") return;
      const payload = event.payload as {
        message?: { content?: string; customType?: string; role?: string };
      };
      if (payload.message?.role === "custom") {
        callMessages.push(payload.message.content ?? "");
      }
    });
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");

    await subagentTool?.execute?.("tool-call-1", {
      subagents: [
        { agentName: "researcher", prompt: "Inspect auth" },
        { agentName: "reviewer", prompt: "Review auth" }
      ]
    });
    await harnessSubscribers[0]?.({
      message: toolResultMessage("tool-call-1"),
      type: "message_end"
    });

    expect(prompt).toHaveBeenNthCalledWith(2, "Inspect auth");
    expect(prompt).toHaveBeenNthCalledWith(3, "Review auth");
    expect(subagentRepository.findByTaskId("task-1")).toHaveLength(2);
    expect(appendCustomMessageEntry.mock.calls.map((call) => call[1])).toEqual([
      'Subagent "researcher" is running.',
      'Subagent "reviewer" is running.'
    ]);
    expect(callMessages).toEqual([
      'Subagent "researcher" is running.',
      'Subagent "reviewer" is running.'
    ]);
  });

  it("defers completed subagent results while the parent harness is running", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    let resolveParentPrompt: (() => void) | undefined;
    prompt.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveParentPrompt = resolve;
    }));
    const result = await runtime.start(createRunInput());
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    const callResult = await subagentTool?.execute?.(
      "tool-call-1",
      subagentInput()
    ) as { details?: { agentId?: string } } | undefined;
    const childAgentId = callResult?.details?.agentId ?? "";

    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "The auth module is isolated.", type: "text" }],
        role: "assistant",
        timestamp: 2
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });

    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      "subagent_result",
      expect.anything(),
      true,
      expect.anything()
    );
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(subagentRepository.findByAgentId(childAgentId)?.status)
      .toBe("completed");

    await harnessSubscribers[0]?.({
      message: toolResultMessage("tool-call-1"),
      type: "message_end"
    });

    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "subagent_result",
      expect.stringContaining("The auth module is isolated."),
      true,
      expect.objectContaining({ agentId: childAgentId, agentName: "researcher" })
    );
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(result.agentId).toMatch(/^agent_/);
    resolveParentPrompt?.();
  });
});
