import type { HostApiRequest, HostApiResult } from "..";

export interface HostApiInstalledSkill {
  readonly disabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly path?: string;
}

export interface HostApiInstalledSkillsResult {
  readonly skills: readonly HostApiInstalledSkill[];
}

export interface HostApiSkillsClient {
  readonly list: () => Promise<HostApiResult<HostApiInstalledSkillsResult>>;
}

export function createSkillsApi(request: HostApiRequest): HostApiSkillsClient {
  return {
    list() {
      return request<HostApiInstalledSkillsResult>({
        path: "/api/v1/skills"
      });
    }
  };
}
