export interface InstalledSkill {
  disabled: boolean;
  id: string;
  name: string;
  path: string;
}

export interface SkillsConfig {
  [skillId: string]: SkillConfigEntry;
}

export interface SkillConfigEntry {
  disabled?: boolean;
  [property: string]: unknown;
}

export interface SkillsService {
  installSkill: (repositoryUrl: string) => Promise<InstalledSkill>;
  listEnabledSkillDirs: () => Promise<string[]>;
  listSkills: () => Promise<InstalledSkill[]>;
  load: () => Promise<void>;
  setSkillDisabled: (
    skillId: string,
    disabled: boolean
  ) => Promise<InstalledSkill | null>;
  uninstallSkill: (skillId: string) => Promise<boolean>;
}
