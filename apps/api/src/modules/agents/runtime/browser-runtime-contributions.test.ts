import { beforeEach, describe, expect, it, vi } from "vitest";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import { createAgentRuntime } from ".";
import { createRunInput, createSessionRepo } from "./test-utils";
import { parseBrowserRuntimeContributions } from "./browser-runtime-contributions";

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

  it("parses Markdown references contributed with browser skills", () => {
    expect(parseBrowserRuntimeContributions({
      skills: [{
        content: "# Browser Context",
        name: "browser-context",
        references: [{ content: "# Guide", path: "guides/test.md" }]
      }]
    })).toEqual({
      skills: [{
        content: "# Browser Context",
        name: "browser-context",
        references: [{ content: "# Guide", path: "guides/test.md" }]
      }]
    });
  });

  it("rejects non-Markdown browser skill references", () => {
    expect(parseBrowserRuntimeContributions({
      skills: [{
        content: "# Browser Context",
        name: "browser-context",
        references: [{ content: "no", path: "guide.txt" }]
      }]
    })).toBeNull();
  });

  it("materializes browser skills and cleans them up after the harness settles", async () => {
    const tempSkillDir = await mkdtemp(join(tmpdir(), "hold-rein-runtime-skills-"));
    let resolvePrompt: (() => void) | undefined;
    prompt.mockReturnValue(new Promise<void>((resolve) => {
      resolvePrompt = resolve;
    }));
    const { repo } = createSessionRepo();
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository(),
      tempSkillDir
    });

    try {
      await runtime.start({
        ...createRunInput(),
        runtimeContributions: {
          skills: [{
            content: "# Browser Context",
            name: "browser-context",
            references: [{ content: "# Guide", path: "guides/test.md" }]
          }]
        }
      });
      const skill = getHarnessSkills()[0];
      if (!skill) throw new Error("Expected a materialized browser skill");
      expect(skill.filePath).not.toContain("browser-runtime://");
      await expect(readFile(skill.filePath, "utf8")).resolves.toBe("# Browser Context");
      await expect(readFile(
        join(skill.filePath, "..", "references", "guides", "test.md"),
        "utf8"
      )).resolves.toBe("# Guide");

      resolvePrompt?.();
      await vi.waitFor(async () => {
        await expect(access(skill.filePath)).rejects.toThrow();
      });
    } finally {
      await rm(tempSkillDir, { force: true, recursive: true });
    }
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

  it("keeps browser tool calls pending until the browser submits a result", async () => {
    vi.useFakeTimers();
    const { repo } = createSessionRepo();
    const runtime = createAgentRuntime({
      approvalStore: createAgentApprovalStore(),
      eventBus: createAgentEventBus(),
      sessionRepo: repo,
      subagentRepository: createInMemorySubagentRepository()
    });

    try {
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
      const settled = vi.fn();
      void execution.then(settled, settled);

      await vi.advanceTimersByTimeAsync(60_001);
      expect(settled).not.toHaveBeenCalled();

      await runtime.submitBrowserToolResult?.({
        agentId: result.agentId,
        content: "Selected text after a long wait",
        toolCallId: "tool-call-1"
      });

      await expect(execution).resolves.toEqual(expect.objectContaining({
        content: [{ text: "Selected text after a long wait", type: "text" }],
        isError: false
      }));
    } finally {
      vi.useRealTimers();
    }
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

function getHarnessSkills(): { filePath: string }[] {
  const options = harnessConstructor.mock.calls.at(-1)?.[0] as
    | { resources?: { skills?: { filePath: string }[] } }
    | undefined;
  return options?.resources?.skills ?? [];
}
