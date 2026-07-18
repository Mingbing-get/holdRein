import type { StartAgentInput } from "../agent-types";
import type { AgentsService } from "../service";
import { parseBrowserRuntimeContributions } from "../runtime/browser-runtime-contributions";

export interface StartAgentBody {
  approvalPolicy?: unknown;
  images?: unknown;
  modelId?: string;
  prompt?: string;
  provider?: string;
  runtimeContributions?: unknown;
  thinkingLevel?: unknown;
  workspacePath?: string;
}

export interface ContinueTaskBody {
  approvalPolicy?: unknown;
  images?: unknown;
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
  const images = parseImageContents(body.images);

  if (images === null) {
    return null;
  }

  const imageInput = images === undefined ? {} : { images };

  if (body.provider === undefined && body.modelId === undefined) {
    return {
      ...options,
      ...contributionInput,
      ...imageInput,
      prompt: body.prompt,
      taskId
    };
  }

  if (typeof body.provider !== "string" || typeof body.modelId !== "string") {
    return null;
  }

  return {
    ...options,
    ...contributionInput,
    ...imageInput,
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
  const images = parseImageContents(body.images);

  if (!options || runtimeContributions === null || images === null) {
    return null;
  }

  return {
    ...options,
    ...(runtimeContributions === undefined ? {} : { runtimeContributions }),
    ...(images === undefined ? {} : { images }),
    modelId: body.modelId,
    prompt: body.prompt,
    provider: body.provider,
    workspacePath: body.workspacePath
  };
}

function parseImageContents(
  value: unknown
): StartAgentInput["images"] | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const images = value.map((item) => {
    if (!isRecord(item)) {
      return null;
    }

    return item.type === "image" &&
      typeof item.data === "string" &&
      typeof item.mimeType === "string"
      ? {
          data: item.data,
          mimeType: item.mimeType,
          type: "image" as const
        }
      : null;
  });

  return images.every((item) => item !== null)
    ? images
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
