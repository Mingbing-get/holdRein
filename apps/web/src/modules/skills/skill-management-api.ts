import type {
  ApiResponse,
  InstalledSkill,
  InstalledSkillsResponse
} from "./skill-management-types";

export async function fetchInstalledSkills(
  apiBaseUrl: string
): Promise<InstalledSkill[]> {
  const response = await fetch(createSkillsUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load skills");
  }

  const payload = (await response.json()) as ApiResponse<InstalledSkillsResponse>;

  return [...payload.data.skills].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function setSkillDisabled(
  apiBaseUrl: string,
  skillId: string,
  disabled: boolean
): Promise<InstalledSkill> {
  const response = await fetch(createSkillUrl(apiBaseUrl, skillId), {
    body: JSON.stringify({ disabled }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Failed to update skill");
  }

  const payload = (await response.json()) as ApiResponse<InstalledSkill>;

  return payload.data;
}

export async function installSkill(
  apiBaseUrl: string,
  repositoryUrl: string
): Promise<InstalledSkill> {
  const response = await fetch(createSkillInstallUrl(apiBaseUrl), {
    body: JSON.stringify({ repositoryUrl }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to install skill");
  }

  const payload = (await response.json()) as ApiResponse<InstalledSkill>;

  return payload.data;
}

export async function uninstallSkill(
  apiBaseUrl: string,
  skillId: string
): Promise<void> {
  const response = await fetch(createSkillUrl(apiBaseUrl, skillId), {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to uninstall skill");
  }
}

export function createSkillsUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/skills`;
}

export function createSkillInstallUrl(apiBaseUrl: string): string {
  return `${createSkillsUrl(apiBaseUrl)}/install`;
}

export function createSkillUrl(apiBaseUrl: string, skillId: string): string {
  return `${createSkillsUrl(apiBaseUrl)}/${encodeURIComponent(skillId)}`;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}
