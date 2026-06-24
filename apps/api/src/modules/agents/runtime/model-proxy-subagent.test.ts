import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentRuntime } from ".";
import type { ModelProxiesService } from "../../model-proxies";
import { createInMemorySubagentRepository } from "../subagent/repository";
import { createContribution, createRunInput, createSessionRepo, getHarnessTool, subagentInput } from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const harnessSetModel = vi.fn().mockResolvedValue(undefined);
const harnessSubscribers: ((event: { message?: unknown; type: string }) => unknown)[] = [];
const resolveContributions = vi.hoisted(() => vi.fn());

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      prompt = prompt;
      setModel = harnessSetModel;
      on = vi.fn();
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

describe("agent runtime proxy model subagents", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessSetModel.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue(createContribution());
  });

  it("starts subagents with the latest proxy-selected real model", async () => {
    const { repo } = createSessionRepo();
    const modelProxiesService = {
      selectCandidate: vi
        .fn()
        .mockReturnValueOnce({ modelId: "gpt-4.1", provider: "openai" })
        .mockReturnValueOnce({ modelId: "gpt-4.1-mini", provider: "openai" })
    } as unknown as ModelProxiesService;
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      modelProxiesService,
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository()
    });

    await runtime.start({
      ...createRunInput(),
      modelId: "coding-agent",
      provider: "local"
    });
    await harnessSubscribers[0]?.({
      message: {
        content: [{ text: "Done", type: "text" }],
        model: "gpt-4.1",
        provider: "openai",
        role: "assistant",
        timestamp: 2,
        usage: { input: 900, output: 200 }
      },
      type: "message_end"
    });

    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    await subagentTool?.execute?.("tool-call-1", subagentInput());

    expect(harnessSetModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "gpt-4.1-mini", provider: "openai" })
    );
    expect(harnessConstructor.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        model: expect.objectContaining({ id: "gpt-4.1-mini", provider: "openai" })
      })
    );
  });
});
