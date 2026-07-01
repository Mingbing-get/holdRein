import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRunInput, createRuntime, createSessionRepo } from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const loadSkills = vi.hoisted(() =>
  vi.fn().mockImplementation(async (_env: unknown, skillDirs: string[]) => ({
    diagnostics: [],
    skills: skillDirs.includes("/plugins/demo/skills")
      ? [{ name: "plugin-dir-skill" }]
      : [
          { name: "workspace-skill" },
          { name: "disabled-workspace-skill" }
        ]
  }))
);
const resolveContributions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    skillDirs: ["/plugins/demo/skills"],
    skills: [{ name: "plugin-skill" }, { name: "disabled-plugin-skill" }],
    systemPrompts: [],
    tools: []
  })
);

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      prompt = prompt;
      subscribe = vi.fn();
      on = vi.fn();

      constructor(options: unknown) {
        harnessConstructor(options);
      }
    },
    loadSkills
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime active capabilities", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    prompt.mockClear();
    resolveContributions.mockClear();
  });

  it("passes active plugin ids to plugin contribution resolution", async () => {
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({
      ...createRunInput(),
      activePlugins: ["@hold-rein/demo-plugin"]
    });

    expect(resolveContributions).toHaveBeenCalledWith(
      expect.anything(),
      { activePluginIds: ["@hold-rein/demo-plugin"] }
    );
  });

  it("filters only non-plugin skills to active skill names when provided", async () => {
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo);

    await runtime.start({
      ...createRunInput(),
      activeSkills: ["workspace-skill", "runtime-skill"],
      runtimeContributions: {
        skills: [
          { content: "# Runtime Skill", name: "runtime-skill" },
          { content: "# Disabled Runtime Skill", name: "disabled-runtime-skill" }
        ]
      }
    });

    const resources = harnessConstructor.mock.calls[0]?.[0]?.resources as
      | { skills?: { name: string }[] }
      | undefined;

    expect(resources?.skills?.map((skill) => skill.name)).toEqual([
      "workspace-skill",
      "plugin-dir-skill",
      "plugin-skill",
      "disabled-plugin-skill",
      "runtime-skill"
    ]);
  });
});
