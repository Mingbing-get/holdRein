import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSkillsService } from "./skills-service";

describe("skills service", () => {
  let rootDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "hold-rein-skills-"));
  });

  afterEach(async () => {
    await rm(rootDir, { force: true, recursive: true });
  });

  it("lists installed skills as enabled unless the config disables them", async () => {
    await createSkill("planning", "planning");
    await writeFile(
      join(rootDir, "skills.json"),
      JSON.stringify({ disabledSkillIds: ["planning"] }),
      "utf8"
    );
    const service = createSkillsService({ rootDir });

    await service.load();
    const skills = await service.listSkills();

    expect(skills).toEqual([
      expect.objectContaining({
        disabled: true,
        id: "planning",
        name: "planning"
      })
    ]);
  });

  it("persists disabled skill state to the config file", async () => {
    await createSkill("validator", "validator");
    const service = createSkillsService({ rootDir });

    await service.setSkillDisabled("validator", true);
    await service.load();

    await expect(readConfig()).resolves.toEqual({
      disabledSkillIds: ["validator"]
    });
    await expect(service.listEnabledSkillDirs()).resolves.toEqual([]);

    await service.setSkillDisabled("validator", false);

    await expect(readConfig()).resolves.toEqual({
      disabledSkillIds: []
    });
    await expect(service.listEnabledSkillDirs()).resolves.toEqual([
      join(rootDir, "validator")
    ]);
  });

  it("installs a skill from a GitHub repository into the skills directory", async () => {
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      await mkdir(targetDir, { recursive: true });
      await writeFile(
        join(targetDir, "SKILL.md"),
        "---\nname: review-helper\n---\n",
        "utf8"
      );
    });
    const service = createSkillsService({ installGitRepository, rootDir });

    const skill = await service.installSkill(
      "https://github.com/acme/review-helper.git"
    );

    expect(installGitRepository).toHaveBeenCalledWith(
      "https://github.com/acme/review-helper.git",
      join(rootDir, "review-helper")
    );
    expect(skill).toEqual(
      expect.objectContaining({
        disabled: false,
        id: "review-helper",
        name: "review-helper"
      })
    );
  });

  it("installs a skill from a GitHub tree URL", async () => {
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      await mkdir(join(targetDir, "tools", "review-helper"), { recursive: true });
      await writeFile(
        join(targetDir, "tools", "review-helper", "SKILL.md"),
        "---\nname: review-helper\n---\n",
        "utf8"
      );
    });
    const service = createSkillsService({ installGitRepository, rootDir });

    const skill = await service.installSkill(
      "https://github.com/acme/skills/tree/main/tools/review-helper"
    );

    expect(installGitRepository).toHaveBeenCalledWith(
      "https://github.com/acme/skills.git",
      expect.any(String),
      "main"
    );
    expect(skill).toEqual(
      expect.objectContaining({
        disabled: false,
        id: "review-helper",
        name: "review-helper"
      })
    );
    await expect(readFile(join(rootDir, "review-helper", "SKILL.md"), "utf8")).resolves.toContain(
      "review-helper"
    );
  });

  it("installs a skill from a GitHub blob SKILL.md URL", async () => {
    const installGitRepository = vi.fn(async (_url: string, targetDir: string) => {
      await mkdir(join(targetDir, "tools", "review-helper"), { recursive: true });
      await writeFile(
        join(targetDir, "tools", "review-helper", "SKILL.md"),
        "---\nname: review-helper\n---\n",
        "utf8"
      );
    });
    const service = createSkillsService({ installGitRepository, rootDir });

    const skill = await service.installSkill(
      "https://github.com/acme/skills/blob/main/tools/review-helper/SKILL.md"
    );

    expect(installGitRepository).toHaveBeenCalledWith(
      "https://github.com/acme/skills.git",
      expect.any(String),
      "main"
    );
    expect(skill).toEqual(
      expect.objectContaining({
        disabled: false,
        id: "review-helper",
        name: "review-helper"
      })
    );
  });

  it("uninstalls a skill and removes stale disabled config", async () => {
    await createSkill("old-skill", "old-skill");
    const service = createSkillsService({ rootDir });

    await service.setSkillDisabled("old-skill", true);

    expect(await service.uninstallSkill("old-skill")).toBe(true);
    await expect(readConfig()).resolves.toEqual({
      disabledSkillIds: []
    });
    await expect(service.listSkills()).resolves.toEqual([]);
  });

  async function createSkill(id: string, name: string) {
    const skillDir = join(rootDir, id);

    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  }

  async function readConfig() {
    return JSON.parse(await readFile(join(rootDir, "skills.json"), "utf8")) as unknown;
  }
});
