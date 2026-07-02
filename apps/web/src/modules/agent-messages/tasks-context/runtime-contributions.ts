import type { WebPlugin } from "@hold-rein/plugin-web";

import type { AppWorkspaceState } from "../../../app/app-workspace-context";
import type {
  ContinueTaskInput,
  StartTaskInput
} from "../agent-message-types";

interface MergeRuntimeContributionOptions {
  readonly workspaceSettings: AppWorkspaceState["workspaceSettings"];
  readonly workspaces: AppWorkspaceState["workspaces"];
}

export function mergeStartTaskRuntimeContributions(
  input: StartTaskInput,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions,
  options: MergeRuntimeContributionOptions
): StartTaskInput {
  const runtimeContributions = mergeRuntimeContributions(
    input.runtimeContributions,
    pluginContributions,
    getActivePluginIdsForWorkspacePath(input.workspacePath, options)
  );
  return runtimeContributions ? { ...input, runtimeContributions } : input;
}

export function mergeContinueTaskRuntimeContributions(
  input: ContinueTaskInput,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions,
  taskId: string,
  options: MergeRuntimeContributionOptions
): ContinueTaskInput {
  const runtimeContributions = mergeRuntimeContributions(
    input.runtimeContributions,
    pluginContributions,
    getActivePluginIdsForTask(taskId, options)
  );
  return runtimeContributions ? { ...input, runtimeContributions } : input;
}

function mergeRuntimeContributions(
  input: WebPlugin.BrowserRuntimeContributions | undefined,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions,
  activePluginIds: readonly string[] | undefined
): WebPlugin.BrowserRuntimeContributions | undefined {
  const tools = [
    ...(input?.tools ?? []),
    ...pluginContributions.tools
      .filter((tool) => isPluginActive(tool.pluginId, activePluginIds))
      .map(toBrowserRuntimeToolSchema)
  ];
  const skills = [
    ...(input?.skills ?? []),
    ...pluginContributions.skills
      .filter((skill) => isPluginActive(skill.pluginId, activePluginIds))
      .map(toBrowserRuntimeSkill)
  ];
  const systemPrompts = [
    ...(input?.systemPrompts ?? []),
    ...pluginContributions.systemPrompts
      .filter((prompt) => isPluginActive(prompt.pluginId, activePluginIds))
      .map((prompt) => prompt.content)
  ];

  if (!tools.length && !skills.length && !systemPrompts.length) {
    return undefined;
  }

  return { skills, systemPrompts, tools };
}

function getActivePluginIdsForWorkspacePath(
  workspacePath: string,
  options: MergeRuntimeContributionOptions
): readonly string[] | undefined {
  const workspace = options.workspaces.find((item) => item.path === workspacePath);
  return workspace ? options.workspaceSettings[workspace.id]?.setting.activePlugins : undefined;
}

function getActivePluginIdsForTask(
  taskId: string,
  options: MergeRuntimeContributionOptions
): readonly string[] | undefined {
  const workspace = options.workspaces.find((item) =>
    item.tasks.some((task) => task.id === taskId)
  );
  return workspace ? options.workspaceSettings[workspace.id]?.setting.activePlugins : undefined;
}

function isPluginActive(
  pluginId: string | undefined,
  activePluginIds: readonly string[] | undefined
): boolean {
  return pluginId === undefined || activePluginIds === undefined || activePluginIds.includes(pluginId);
}

function toBrowserRuntimeToolSchema(
  tool: WebPlugin.ResolvedBrowserRuntimeToolSchema
): WebPlugin.BrowserRuntimeToolSchema {
  return {
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: tool.inputSchema,
    name: tool.name
  };
}

function toBrowserRuntimeSkill(
  skill: WebPlugin.ResolvedBrowserRuntimeSkill
): WebPlugin.BrowserRuntimeSkill {
  return {
    content: skill.content,
    ...(skill.description === undefined ? {} : { description: skill.description }),
    name: skill.name
  };
}
