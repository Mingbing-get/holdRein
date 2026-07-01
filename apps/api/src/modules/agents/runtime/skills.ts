import {
  loadSkills,
  type ExecutionEnv,
  type Skill
} from "@earendil-works/pi-agent-core/node";

import type { BrowserRuntimeSkill } from "../agent-types";
import type { SkillsService } from "../../skills";
import { toRuntimeSkills } from "./browser-runtime-contributions";
import { getRuntimeSkillDirs } from "./support";

export interface LoadRuntimeSkillsInput {
  activeSkills?: readonly string[] | undefined;
  contributionSkillDirs?: readonly string[] | undefined;
  contributionSkills?: readonly Skill[] | undefined;
  env: ExecutionEnv;
  runtimeContributionSkills?: readonly BrowserRuntimeSkill[] | undefined;
  skillDirs?: string[] | undefined;
  skillsService?: SkillsService | undefined;
  workspacePath: string;
}

export async function loadRuntimeSkills(
  input: LoadRuntimeSkillsInput
): Promise<Skill[]> {
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
  const runtimeSkills = toRuntimeSkills(input.runtimeContributionSkills);
  const filterActiveSkill = (skill: Skill) =>
    activeSkillNames === undefined || activeSkillNames.has(skill.name);

  return [
    ...loadedSkills.filter(filterActiveSkill),
    ...pluginDirSkills,
    ...(input.contributionSkills ?? []),
    ...runtimeSkills.filter(filterActiveSkill)
  ];
}
