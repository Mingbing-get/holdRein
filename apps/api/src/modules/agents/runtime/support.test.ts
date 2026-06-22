import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { SKILL_DIR } from "../../../config/const";
import { getSkillDirs, listWorkspaceSkills } from "./support";

let rootPath = "";

afterEach(async () => {
  if (rootPath) {
    await rm(rootPath, { force: true, recursive: true });
    rootPath = "";
  }
});

describe("agent runtime support", () => {
  it("always includes mandatory workspace and central skill directories", () => {
    expect(getSkillDirs("/tmp/workspace")).toEqual([
      "/tmp/workspace/.agents/skills",
      "/tmp/workspace/.hold-rein/skills",
      SKILL_DIR
    ]);
  });

  it("preserves configured skill directories after mandatory directories", () => {
    expect(getSkillDirs("/tmp/workspace", ["/plugin/skills"])).toEqual([
      "/tmp/workspace/.agents/skills",
      "/tmp/workspace/.hold-rein/skills",
      SKILL_DIR,
      "/plugin/skills"
    ]);
  });

  it("lists skill names and paths from workspace skill directories", async () => {
    rootPath = await mkdtemp(join(tmpdir(), "hold-rein-skills-"));
    const workspaceSkillPath = join(rootPath, ".agents", "skills", "reviewer");
    const holdReinSkillPath = join(rootPath, ".hold-rein", "skills", "planner");
    const ignoredPath = join(rootPath, ".agents", "skills", "notes");

    await mkdir(workspaceSkillPath, { recursive: true });
    await mkdir(holdReinSkillPath, { recursive: true });
    await mkdir(ignoredPath, { recursive: true });
    await writeFile(
      join(workspaceSkillPath, "SKILL.md"),
      "---\nname: code-reviewer\n---\n# Code Reviewer\n"
    );
    await writeFile(join(holdReinSkillPath, "SKILL.md"), "# Planner\n");

    const skills = await listWorkspaceSkills(rootPath);

    expect(skills).toEqual(expect.arrayContaining([
      {
        name: "code-reviewer",
        path: workspaceSkillPath
      },
      {
        name: "planner",
        path: holdReinSkillPath
      }
    ]));
    expect(skills).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ignoredPath })
    ]));
  });
});
