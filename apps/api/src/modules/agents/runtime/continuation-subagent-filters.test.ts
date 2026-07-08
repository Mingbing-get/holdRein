import { rmSync } from "node:fs";
import type { Skill } from "@earendil-works/pi-agent-core";
import type { ServerPlugin } from "@hold-rein/plugin-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
const tempDirectories: string[] = [];
const resolveContributions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    skillDirs: [],
    skills: [],
    systemPrompts: [],
    tools: []
  })
);

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

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

describe("agent runtime continuation subagent filters", () => {
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

  it("filters continuation subagent plugins, tools, and skills when requested", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const allowedTool = { name: "allowed_tool" } as ServerPlugin.PluginTool;
    const blockedTool = { name: "blocked_tool" } as ServerPlugin.PluginTool;
    const pluginFilter = vi.fn((plugins: ServerPlugin.Plugin[]) =>
      plugins.filter((plugin) => plugin.id === "allowed-plugin")
    );
    const toolFilter = vi.fn((tools: ServerPlugin.PluginTool[]) =>
      tools.filter((tool) => tool.name === "allowed_tool")
    );
    const skillFilter = vi.fn((skills: Skill[]) =>
      skills.filter((skill) => skill.name === "allowed-skill")
    );

    resolveContributions.mockImplementation(async (context, options) => {
      if (context.agentName === "reviewer") {
        const plugins = options?.pluginFilter?.([
          { id: "allowed-plugin" },
          { id: "blocked-plugin" }
        ]) ?? [];

        return createContribution({
          skills: [
            {
              content: "Allowed skill",
              description: "Allowed",
              name: "allowed-skill"
            },
            {
              content: "Blocked skill",
              description: "Blocked",
              name: "blocked-skill"
            }
          ],
          tools: plugins.some((plugin: ServerPlugin.Plugin) =>
            plugin.id === "allowed-plugin"
          )
            ? [allowedTool, blockedTool]
            : [blockedTool]
        });
      }

      return createContribution({
        onAgentEnd: vi.fn().mockResolvedValue({
          agentName: "reviewer",
          pluginFilter,
          prompt: "Run filtered follow-up",
          skillFilter,
          toolFilter,
          useSubagent: true
        })
      });
    });
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    await runtime.start(createRunInput());
    await harnessSubscribers[0]?.({ type: "agent_end" });

    const childOptions = harnessConstructor.mock.calls[1]?.[0] as {
      activeToolNames?: string[];
      resources?: { skills?: { name: string }[] };
      tools?: { name: string }[];
    };
    expect(pluginFilter).toHaveBeenCalledWith([
      { id: "allowed-plugin" },
      { id: "blocked-plugin" }
    ]);
    expect(toolFilter).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: "allowed_tool" }),
      expect.objectContaining({ name: "blocked_tool" }),
      expect.objectContaining({ name: "call_subagent" })
    ]));
    expect(skillFilter).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: "allowed-skill" }),
      expect.objectContaining({ name: "blocked-skill" })
    ]));
    expect(childOptions.tools?.map((tool) => tool.name)).toEqual(["allowed_tool"]);
    expect(childOptions.activeToolNames).toEqual(["allowed_tool"]);
    expect(childOptions.resources?.skills?.map((skill) => skill.name)).toEqual([
      "allowed-skill"
    ]);
  });

  it("ignores continuation filters when the continuation stays in the current harness", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const pluginFilter = vi.fn((plugins: ServerPlugin.Plugin[]) => plugins);
    const toolFilter = vi.fn((tools: ServerPlugin.PluginTool[]) => tools);
    const skillFilter = vi.fn((skills: Skill[]) => skills);
    resolveContributions.mockResolvedValue(createContribution({
      onAgentEnd: vi.fn().mockResolvedValue({
        pluginFilter,
        prompt: "Continue directly",
        skillFilter,
        toolFilter,
        useSubagent: false
      })
    }));
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    await runtime.start(createRunInput());
    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(pluginFilter).not.toHaveBeenCalled();
    expect(toolFilter).not.toHaveBeenCalled();
    expect(skillFilter).not.toHaveBeenCalled();
    expect(harnessConstructor).toHaveBeenCalledTimes(2);
  });
});
