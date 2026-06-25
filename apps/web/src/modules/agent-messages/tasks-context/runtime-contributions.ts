import type { WebPlugin } from "@hold-rein/plugin-web";

import type {
  ContinueTaskInput,
  StartTaskInput
} from "../agent-message-types";

export function mergeStartTaskRuntimeContributions(
  input: StartTaskInput,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions
): StartTaskInput {
  const runtimeContributions = mergeRuntimeContributions(
    input.runtimeContributions,
    pluginContributions
  );
  return runtimeContributions ? { ...input, runtimeContributions } : input;
}

export function mergeContinueTaskRuntimeContributions(
  input: ContinueTaskInput,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions
): ContinueTaskInput {
  const runtimeContributions = mergeRuntimeContributions(
    input.runtimeContributions,
    pluginContributions
  );
  return runtimeContributions ? { ...input, runtimeContributions } : input;
}

function mergeRuntimeContributions(
  input: WebPlugin.BrowserRuntimeContributions | undefined,
  pluginContributions: WebPlugin.ResolvedBrowserRuntimeContributions
): WebPlugin.BrowserRuntimeContributions | undefined {
  const tools = [...(input?.tools ?? []), ...pluginContributions.tools];
  const skills = [...(input?.skills ?? []), ...pluginContributions.skills];
  const systemPrompts = [
    ...(input?.systemPrompts ?? []),
    ...pluginContributions.systemPrompts
  ];

  if (!tools.length && !skills.length && !systemPrompts.length) {
    return undefined;
  }

  return { skills, systemPrompts, tools };
}
