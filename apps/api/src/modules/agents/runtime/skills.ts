import {
  loadSkills,
  type ExecutionEnv,
  type Skill
} from "@earendil-works/pi-agent-core/node";

import type { BrowserRuntimeSkill } from "../agent-types";
import type { SkillsService } from "../../skills";
import { TEMP_SKILL_DIR } from "../../../config/const";
import {
  materializeInlineSkills,
  type InlineRuntimeSkill
} from "./materialized-skills";
import { getRuntimeSkillDirs } from "./support";

export interface LoadRuntimeSkillsInput {
  activeSkills?: readonly string[] | undefined;
  contributionSkillDirs?: readonly string[] | undefined;
  contributionSkills?: readonly InlineRuntimeSkill[] | undefined;
  env: ExecutionEnv;
  runtimeContributionSkills?: readonly BrowserRuntimeSkill[] | undefined;
  skillDirs?: string[] | undefined;
  skillsService?: SkillsService | undefined;
  tempSkillDir?: string | undefined;
  workspacePath: string;
}

export interface LoadedRuntimeSkills {
  cleanup: () => Promise<void>;
  skills: Skill[];
}

export async function loadRuntimeSkills(
  input: LoadRuntimeSkillsInput
): Promise<LoadedRuntimeSkills> {
  const skillDirs = await getRuntimeSkillDirs(
    input.workspacePath,
    input.skillDirs,
    input.skillsService
  );
  const { skills: loadedSkills } = await loadSkills(input.env, skillDirs);
  const pluginSkillDirs = Array.from(new Set(input.contributionSkillDirs ?? []));
  const { skills: pluginDirSkills } = pluginSkillDirs.length === 0
    ? { skills: [] }
    : await loadSkills(input.env, pluginSkillDirs);
  const activeSkillNames = input.activeSkills === undefined
    ? undefined
    : new Set(input.activeSkills);
  const filterActiveSkill = (skill: Skill) =>
    activeSkillNames === undefined || activeSkillNames.has(skill.name);
  const runtimeSkills = (input.runtimeContributionSkills ?? [])
    .filter((skill) => activeSkillNames === undefined || activeSkillNames.has(skill.name));
  const inlineSkills: InlineRuntimeSkill[] = [
    ...(input.contributionSkills ?? []),
    ...runtimeSkills
  ];
  const materialized = inlineSkills.length === 0
    ? { cleanup: async () => undefined, skills: [] }
    : await materializeInlineSkills({
        rootDir: input.tempSkillDir ?? TEMP_SKILL_DIR,
        skills: inlineSkills
      });

  return {
    cleanup: materialized.cleanup,
    skills: [
      ...loadedSkills.filter(filterActiveSkill),
      ...pluginDirSkills,
      ...materialized.skills
    ]
  };
}
