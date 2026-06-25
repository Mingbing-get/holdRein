import type { StartAgentInput } from "../agent-types";
import type { AgentsService } from "../service";
import { parseBrowserRuntimeContributions } from "../runtime/browser-runtime-contributions";

export interface StartAgentBody {
  approvalPolicy?: unknown;
  modelId?: string;
  prompt?: string;
  provider?: string;
  runtimeContributions?: unknown;
  thinkingLevel?: unknown;
  workspacePath?: string;
}

export interface ContinueTaskBody {
  approvalPolicy?: unknown;
  modelId?: string;
  prompt?: string;
  provider?: string;
  runtimeContributions?: unknown;
  thinkingLevel?: unknown;
}

export function parseContinueTaskBody(
  body: ContinueTaskBody,
  taskId: string
): Parameters<AgentsService["continueTask"]>[0] | null {
  if (typeof body.prompt !== "string") {
    return null;
  }

  const options = parseTaskRunOptions(body);
  const runtimeContributions = parseBrowserRuntimeContributions(
    body.runtimeContributions
  );

  if (!options || runtimeContributions === null) {
    return null;
  }

  const contributionInput =
    runtimeContributions === undefined ? {} : { runtimeContributions };

  if (body.provider === undefined && body.modelId === undefined) {
    return { ...options, ...contributionInput, prompt: body.prompt, taskId };
  }

  if (typeof body.provider !== "string" || typeof body.modelId !== "string") {
    return null;
  }

  return {
    ...options,
    ...contributionInput,
    modelId: body.modelId,
    prompt: body.prompt,
    provider: body.provider,
    taskId
  };
}

export function parseStartAgentBody(
  body: StartAgentBody
): StartAgentInput | null {
  if (
    typeof body.workspacePath !== "string" ||
    typeof body.provider !== "string" ||
    typeof body.modelId !== "string" ||
    typeof body.prompt !== "string"
  ) {
    return null;
  }

  const options = parseTaskRunOptions(body);
  const runtimeContributions = parseBrowserRuntimeContributions(
    body.runtimeContributions
  );

  if (!options || runtimeContributions === null) {
    return null;
  }

  return {
    ...options,
    ...(runtimeContributions === undefined ? {} : { runtimeContributions }),
    modelId: body.modelId,
    prompt: body.prompt,
    provider: body.provider,
    workspacePath: body.workspacePath
  };
}

export function parseAfterSequence(value: unknown): number | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

export function getRequiredQueryString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function parseTaskRunOptions(body: {
  approvalPolicy?: unknown;
  thinkingLevel?: unknown;
}): Pick<StartAgentInput, "approvalPolicy" | "thinkingLevel"> | null {
  const approvalPolicy = body.approvalPolicy ?? "approval";
  const thinkingLevel = body.thinkingLevel ?? "medium";

  if (approvalPolicy !== "approval" && approvalPolicy !== "run_all") {
    return null;
  }

  if (!isThinkingLevel(thinkingLevel)) {
    return null;
  }

  return { approvalPolicy, thinkingLevel };
}

function isThinkingLevel(
  value: unknown
): value is StartAgentInput["thinkingLevel"] {
  return (
    value === "off" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  );
}
