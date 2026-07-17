import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import {
  createContribution,
  createRunInput,
  createRuntime,
  createSessionRepo
} from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
const harnessSetTools = vi.fn();
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
      setTools = harnessSetTools;
      subscribe = vi.fn((listener: (event: { type: string }) => unknown) => {
        if (listener.constructor.name === "AsyncFunction") {
          harnessSubscribers.push(listener);
        }
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

describe("independent continuation subagents", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessOn.mockClear();
    harnessSetTools.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue(createContribution());
  });

  it("does not append completed results to the parent context before ending the task", async () => {
    const { appendCustomMessageEntry, create, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    resolveContributions
      .mockResolvedValueOnce(createContribution({
        onAgentEnd: vi.fn().mockResolvedValue({
          agentName: "memory-writer",
          independent: true,
          prompt: "Persist extracted memories",
          useSubagent: true
        })
      }))
      .mockResolvedValue(createContribution());
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    const result = await runtime.start(createRunInput());
    const parentEventTypes: string[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      parentEventTypes.push(event.type);
    });
    await harnessSubscribers[0]?.({ type: "agent_end" });
    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "Stored memory candidates.", type: "text" }],
        role: "assistant"
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });

    const [childRow] = subagentRepository.findByTaskId("task-1");
    expect(childRow).toEqual(expect.objectContaining({
      agentName: "memory-writer",
      parentAgentId: result.agentId,
      status: "completed"
    }));
    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "callsubagent",
      'Subagent "memory-writer" is running.',
      true,
      expect.objectContaining({ agentName: "memory-writer" })
    );
    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      "subagent_result",
      expect.anything(),
      true,
      expect.anything()
    );
    expect(parentEventTypes).toContain("task_end");
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
