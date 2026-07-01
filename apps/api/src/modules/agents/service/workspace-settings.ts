import { readFile } from "node:fs/promises";
import { join } from "node:path";

interface WorkspaceCapabilitiesInput {
  activePlugins?: readonly string[] | undefined;
  activeSkills?: readonly string[] | undefined;
  workspacePath: string;
}

interface WorkspaceCapabilities {
  activePlugins?: readonly string[];
  activeSkills?: readonly string[];
}

interface WorkspaceSetting {
  activePlugins?: readonly string[];
  activeSkills?: readonly string[];
}

const WORKSPACE_SETTING_PATH = [".hold-rein", "setting.json"] as const;

export async function resolveWorkspaceCapabilities(
  input: WorkspaceCapabilitiesInput
): Promise<WorkspaceCapabilities> {
  const setting = await readWorkspaceSetting(input.workspacePath);
  const activePlugins = mergeCapability(input.activePlugins, setting.activePlugins);
  const activeSkills = mergeCapability(input.activeSkills, setting.activeSkills);

  return {
    ...(activePlugins === undefined ? {} : { activePlugins }),
    ...(activeSkills === undefined ? {} : { activeSkills })
  };
}

async function readWorkspaceSetting(
  workspacePath: string
): Promise<WorkspaceSetting> {
  try {
    const content = await readFile(
      join(workspacePath, ...WORKSPACE_SETTING_PATH),
      "utf8"
    );

    return toWorkspaceSetting(JSON.parse(content));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function toWorkspaceSetting(value: unknown): WorkspaceSetting {
  if (!isRecord(value)) {
    return {};
  }
  const activePlugins = readStringArray(value, "activePlugins");
  const activeSkills = readStringArray(value, "activeSkills");

  return {
    ...(activePlugins === undefined ? {} : { activePlugins }),
    ...(activeSkills === undefined ? {} : { activeSkills })
  };
}

function readStringArray(
  value: Record<string, unknown>,
  key: keyof WorkspaceSetting
): readonly string[] | undefined {
  const field = value[key];

  if (!Array.isArray(field) || !field.every((item) => typeof item === "string")) {
    return undefined;
  }

  return field;
}

function mergeCapability(
  runtimeCapability: readonly string[] | undefined,
  workspaceCapability: readonly string[] | undefined
): readonly string[] | undefined {
  if (runtimeCapability === undefined && workspaceCapability === undefined) {
    return undefined;
  }

  if (runtimeCapability === undefined) {
    return workspaceCapability;
  }

  if (workspaceCapability === undefined) {
    return runtimeCapability;
  }

  const workspaceCapabilitySet = new Set(workspaceCapability);

  return runtimeCapability.filter((item) => workspaceCapabilitySet.has(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
