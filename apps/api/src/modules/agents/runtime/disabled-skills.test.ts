import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRuntime, createRunInput, createSessionRepo } from "./test-utils";
import { createSkillsService } from "../../skills";

const harnessConstructor = vi.fn();
const loadSkills = vi.hoisted(() => vi.fn().mockResolvedValue({
  diagnostics: [],
  skills: []
}));
const prompt = vi.fn().mockResolvedValue(undefined);
const resolveContributions = vi.hoisted(() => vi.fn().mockResolvedValue({
  skillDirs: [],
  skills: [],
  systemPrompts: [],
  tools: []
}));

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
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
    loadSkills
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime disabled skills", () => {
  let rootDir: string;
  let workspacePath: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "hold-rein-global-skills-"));
    workspacePath = await mkdtemp(join(tmpdir(), "hold-rein-workspace-"));
    harnessConstructor.mockClear();
    loadSkills.mockClear();
    prompt.mockClear();
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue({
      skillDirs: [],
      skills: [],
      systemPrompts: [],
      tools: []
    });
  });

  afterEach(async () => {
    await rm(rootDir, { force: true, recursive: true });
    await rm(workspacePath, { force: true, recursive: true });
  });

  it("excludes disabled global skills from model resources", async () => {
    await createSkill(rootDir, "enabled-skill", "enabled-skill");
    await createSkill(rootDir, "disabled-skill", "disabled-skill");
    const skillsService = createSkillsService({ rootDir });

    await skillsService.setSkillDisabled("disabled-skill", true);
    const { repo } = createSessionRepo();
    const runtime = createRuntime(repo, undefined, undefined, undefined, undefined, {
      skillsService
    });

    await runtime.start({ ...createRunInput(), workspacePath });

    expect(loadSkills).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([join(rootDir, "enabled-skill")])
    );
    expect(loadSkills).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.arrayContaining([join(rootDir, "disabled-skill")])
    );
  });

  async function createSkill(root: string, id: string, name: string) {
    const skillDir = join(root, id);

    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  }
});
