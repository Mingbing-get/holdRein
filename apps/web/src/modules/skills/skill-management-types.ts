export interface ApiResponse<TData> {
  code: number;
  data: TData;
  msg: string;
}

export interface InstalledSkill {
  disabled: boolean;
  id: string;
  name: string;
  path?: string;
}

export interface InstalledSkillsResponse {
  skills: InstalledSkill[];
}
