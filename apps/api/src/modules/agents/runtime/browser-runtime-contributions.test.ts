import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import { createAgentRuntime } from ".";
import { createRunInput, createSessionRepo } from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
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
      on = vi.fn();
      prompt = prompt;
      subscribe = vi.fn();

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

describe("agent runtime browser contributions", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessInterrupt.mockClear();
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue({
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: []
    });
  });

  it("proxies browser tool calls through the event bus", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus,
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository()
    });

    const result = await runtime.start({
      ...createRunInput(),
      runtimeContributions: {
        tools: [
          { inputSchema: { type: "object" }, name: "read_browser_selection" }
        ]
      }
    });
    const tool = getHarnessTool("read_browser_selection");
    expect(tool).toBeDefined();
    if (!tool) return;

    const events: unknown[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type === "browser_tool_call_requested") events.push(event);
    });

    const execution = tool.execute("tool-call-1", { scope: "selection" });
    expect(events).toEqual([
      expect.objectContaining({
        payload: {
          arguments: { scope: "selection" },
          toolCallId: "tool-call-1",
          toolName: "read_browser_selection"
        },
        type: "browser_tool_call_requested"
      })
    ]);

    await runtime.submitBrowserToolResult?.({
      agentId: result.agentId,
      content: "Selected text",
      toolCallId: "tool-call-1"
    });

    await expect(execution).resolves.toEqual(expect.objectContaining({
      content: [{ text: "Selected text", type: "text" }],
      isError: false
    }));
  });

  it("resolves pending browser tools with an error on interrupt", async () => {
    prompt.mockReturnValue(new Promise(() => undefined));
    const { repo } = createSessionRepo();
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository()
    });

    const result = await runtime.start({
      ...createRunInput(),
      runtimeContributions: {
        tools: [
          { inputSchema: { type: "object" }, name: "read_browser_selection" }
        ]
      }
    });
    const tool = getHarnessTool("read_browser_selection");
    expect(tool).toBeDefined();
    if (!tool) return;

    const execution = tool.execute("tool-call-1", {});
    await runtime.interrupt(result.agentId);

    await expect(execution).resolves.toEqual(expect.objectContaining({
      content: [
        { text: "Browser tool call was interrupted.", type: "text" }
      ],
      isError: true
    }));
    await expect(
      runtime.submitBrowserToolResult?.({
        agentId: result.agentId,
        content: "Late result",
        toolCallId: "tool-call-1"
      })
    ).resolves.toBe(false);
  });
});

function getHarnessTool(name: string):
  | { execute: (toolCallId: string, input: unknown) => Promise<unknown>; name: string }
  | undefined {
  const options = harnessConstructor.mock.calls.at(-1)?.[0] as
    | {
        tools?: {
          execute: (toolCallId: string, input: unknown) => Promise<unknown>;
          name: string;
        }[];
      }
    | undefined;

  return options?.tools?.find((tool) => tool.name === name);
}
