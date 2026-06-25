import type { AgentMessageFetcher } from "./api";
import { submitBrowserToolResult } from "./api";
import type { AgentEventEnvelope, PendingApproval } from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { executeBrowserTool } from "./browser-tools";

export function handleBrowserToolEvent(input: {
  apiBaseUrl: string;
  event: AgentEventEnvelope;
  fetcher: AgentMessageFetcher;
  requestApproval?: (
    approval: PendingApproval
  ) => Promise<WebPlugin.BrowserToolBeforeExecuteResult>;
  taskId: string;
}): void {
  const payload = getBrowserToolCallPayload(input.event);
  if (!payload) return;

  void executeBrowserTool({
    agentId: input.event.agentId,
    arguments: payload.arguments,
    ...(input.requestApproval === undefined
      ? {}
      : {
          requestApproval: (title?: string) =>
            input.requestApproval?.({
              agentId: input.event.agentId,
              approvalId: `browser_approval_${payload.toolCallId}`,
              ...(title === undefined ? {} : { title }),
              tool: {
                input: payload.arguments,
                name: payload.toolName,
                toolCallId: payload.toolCallId
              }
            }) ?? Promise.resolve(undefined)
        }),
    taskId: input.taskId,
    toolCallId: payload.toolCallId,
    toolName: payload.toolName
  })
    .then((result) =>
      submitBrowserToolResult(
        input.apiBaseUrl,
        {
          agentId: input.event.agentId,
          content: result.content,
          isError: result.isError,
          toolCallId: payload.toolCallId
        },
        input.fetcher
      )
    )
    .catch(() => undefined);
}

function getBrowserToolCallPayload(event: AgentEventEnvelope):
  | {
      arguments: Record<string, unknown>;
      toolCallId: string;
      toolName: string;
    }
  | null {
  if (event.type !== "browser_tool_call_requested") return null;
  const payload = event.payload;
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return null;
  }
  const toolCallId = (payload as { toolCallId?: unknown }).toolCallId;
  const toolName = (payload as { toolName?: unknown }).toolName;
  const args = (payload as { arguments?: unknown }).arguments;
  if (typeof toolCallId !== "string" || typeof toolName !== "string") {
    return null;
  }
  return {
    arguments:
      typeof args === "object" && args !== null && !Array.isArray(args)
        ? (args as Record<string, unknown>)
        : {},
    toolCallId,
    toolName
  };
}
