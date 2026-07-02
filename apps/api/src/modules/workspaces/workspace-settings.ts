import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getDefaultSkillsService, type SkillsService } from "../skills";
import { createPluginsService } from "../plugins/plugins-service";
import type { PluginsService } from "../plugins/plugins-types";
import { listWorkspaceSkills } from "../agents/runtime/support";
import type { WorkspaceRepository } from "./workspace-repository";

export interface WorkspaceSetting {
  activePlugins?: readonly string[];
  activeSkills?: readonly string[];
}

export interface WorkspaceSettingOption {
  id: string;
  name: string;
}

export interface WorkspaceSkillSettingOption extends WorkspaceSettingOption {
  path: string;
  source: "global" | "workspace";
}

export interface WorkspaceSettingDetails {
  pluginOptions: WorkspaceSettingOption[];
  setting: WorkspaceSetting;
  skillOptions: WorkspaceSkillSettingOption[];
  workspaceId: string;
}

export interface UpdateWorkspaceSettingInput {
  activePlugins?: readonly string[] | null;
  activeSkills?: readonly string[] | null;
}

export interface CreateWorkspaceSettingsServiceOptions {
  pluginsService?: PluginsService;
  repository: WorkspaceRepository;
  skillDirs?: string[];
  skillsService?: SkillsService;
}

const WORKSPACE_SETTING_DIR = ".hold-rein";
const WORKSPACE_SETTING_FILE = "setting.json";

export function createWorkspaceSettingsService({
  pluginsService = createPluginsService(),
  repository,
  skillDirs,
  skillsService = getDefaultSkillsService()
}: CreateWorkspaceSettingsServiceOptions) {
  return {
    getWorkspaceSetting: async (
      workspaceId: string
    ): Promise<WorkspaceSettingDetails | undefined> => {
      const workspace = repository.findWorkspaceById(workspaceId);

      if (!workspace) {
        return undefined;
      }

      const [setting, pluginOptions, skillOptions] = await Promise.all([
        readWorkspaceSetting(workspace.path),
        listPluginOptions(pluginsService),
        listSkillOptions(workspace.path, skillDirs, skillsService)
      ]);

      return {
        pluginOptions,
        setting,
        skillOptions,
        workspaceId
      };
    },
    updateWorkspaceSetting: async (
      workspaceId: string,
      input: UpdateWorkspaceSettingInput
    ): Promise<{ setting: WorkspaceSetting; workspaceId: string } | undefined> => {
      const workspace = repository.findWorkspaceById(workspaceId);

      if (!workspace) {
        return undefined;
      }

      const setting = await writeWorkspaceSetting(workspace.path, input);

      return { setting, workspaceId };
    }
  };
}

export async function readWorkspaceSetting(
  workspacePath: string
): Promise<WorkspaceSetting> {
  const value = await readWorkspaceSettingRecord(workspacePath);

  return toWorkspaceSetting(value);
}

async function writeWorkspaceSetting(
  workspacePath: string,
  input: UpdateWorkspaceSettingInput
): Promise<WorkspaceSetting> {
  const existing = await readWorkspaceSettingRecord(workspacePath);
  const next = { ...existing };

  applySettingField(next, "activePlugins", input.activePlugins);
  applySettingField(next, "activeSkills", input.activeSkills);
  await mkdir(join(workspacePath, WORKSPACE_SETTING_DIR), { recursive: true });
  await writeFile(
    getWorkspaceSettingPath(workspacePath),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8"
  );

  return toWorkspaceSetting(next);
}

async function readWorkspaceSettingRecord(
  workspacePath: string
): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(
      await readFile(getWorkspaceSettingPath(workspacePath), "utf8")
    ) as unknown;

    return isRecord(value) ? value : {};
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function getWorkspaceSettingPath(workspacePath: string): string {
  return join(workspacePath, WORKSPACE_SETTING_DIR, WORKSPACE_SETTING_FILE);
}

function applySettingField(
  target: Record<string, unknown>,
  key: keyof WorkspaceSetting,
  value: readonly string[] | null | undefined
): void {
  if (value === undefined) {
    return;
  }

  if (value === null) {
    if (key === "activePlugins") {
      delete target.activePlugins;
      return;
    }

    delete target.activeSkills;
    return;
  }

  target[key] = [...new Set(value)].sort();
}

function toWorkspaceSetting(value: Record<string, unknown>): WorkspaceSetting {
  const activePlugins = readStringArray(value.activePlugins);
  const activeSkills = readStringArray(value.activeSkills);

  return {
    ...(activePlugins === undefined ? {} : { activePlugins }),
    ...(activeSkills === undefined ? {} : { activeSkills })
  };
}

function readStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return undefined;
  }

  return value;
}

async function listPluginOptions(
  pluginsService: PluginsService
): Promise<WorkspaceSettingOption[]> {
  const plugins = await pluginsService.listPlugins();

  return plugins
    .filter((plugin) => !plugin.disabled)
    .map((plugin) => ({ id: plugin.id, name: plugin.name }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function listSkillOptions(
  workspacePath: string,
  skillDirs: string[] | undefined,
  skillsService: SkillsService
): Promise<WorkspaceSkillSettingOption[]> {
  const [globalSkills, skills] = await Promise.all([
    skillsService.listSkills(),
    listWorkspaceSkills(workspacePath, skillDirs, skillsService)
  ]);
  const globalSkillPaths = new Set(
    globalSkills.map((skill) => skill.path)
  );

  return skills
    .map((skill) => {
      const source: WorkspaceSkillSettingOption["source"] =
        globalSkillPaths.has(skill.path) ? "global" : "workspace";

      return {
        id: skill.name,
        name: skill.name,
        path: skill.path,
        source
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
