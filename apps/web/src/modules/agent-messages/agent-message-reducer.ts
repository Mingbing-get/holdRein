import type {
  AgentEventEnvelope,
  AgentMessage,
  AgentTaskState,
  AssistantMessage,
  PendingApproval,
  ThinkingContent,
  TextContent
} from "./agent-message-types";

export type AgentTaskAction =
  | { prompt: string; type: "prompt_submitted" }
  | { approvalId: string; type: "approval_decided" }
  | { event: AgentEventEnvelope; type: "event_received" }
  | { messages: AgentMessage[]; type: "history_loaded" }
  | { message: string; type: "subscription_failed" };

export function createInitialAgentTaskState(taskId: string): AgentTaskState {
  return {
    error: null,
    lastSequence: 0,
    messages: [],
    pendingApprovals: [],
    runs: [],
    status: "idle",
    taskId
  };
}

export function reduceAgentTaskState(
  state: AgentTaskState,
  action: AgentTaskAction
): AgentTaskState {
  if (action.type === "prompt_submitted") {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          content: [{ text: action.prompt, type: "text" }],
          id: `prompt-${state.messages.length}`,
          role: "user",
          timestamp: Date.now()
        }
      ],
      status: "running"
    };
  }
  if (action.type === "history_loaded") {
    return { ...state, messages: action.messages };
  }
  if (action.type === "subscription_failed") {
    return { ...state, error: action.message, status: "error" };
  }
  if (action.type === "approval_decided") {
    return {
      ...state,
      pendingApprovals: state.pendingApprovals.filter(
        (approval) => approval.approvalId !== action.approvalId
      )
    };
  }

  const next = {
    ...state,
    lastSequence: Math.max(state.lastSequence, action.event.sequence)
  };
  const payload = getRecord(action.event.payload);

  if (action.event.type === "approval_requested") {
    const approval = getPendingApproval(payload);
    if (
      !approval ||
      next.pendingApprovals.some(
        (candidate) => candidate.approvalId === approval.approvalId
      )
    ) {
      return next;
    }
    return {
      ...next,
      pendingApprovals: [...next.pendingApprovals, approval]
    };
  }
  if (action.event.type === "message_start") {
    const message = payload?.message as AgentMessage | undefined;
    return message ? upsertMessage(next, message) : next;
  }
  if (action.event.type === "message_delta") {
    const messageId = payload?.messageId;
    const delta = getRecord(payload?.delta);
    return typeof messageId === "string" && delta
      ? mergeAssistantDelta(next, messageId, delta)
      : next;
  }
  if (action.event.type === "message_end") {
    const message = payload?.message as AgentMessage | undefined;
    return message ? upsertMessage(next, message) : next;
  }
  if (action.event.type === "agent_error") {
    const message = typeof payload?.message === "string" ? payload.message : "Agent run failed";
    return { ...next, error: message, status: "error" };
  }
  if (action.event.type === "agent_end") {
    return { ...next, status: "completed" };
  }
  return next;
}

function upsertMessage(state: AgentTaskState, message: AgentMessage): AgentTaskState {
  const index = state.messages.findIndex((candidate) => candidate.id === message.id);
  if (index === -1) {
    const optimisticIndex =
      message.role === "user"
        ? state.messages.findIndex(
            (candidate) =>
              candidate.role === "user" &&
              candidate.id.startsWith("prompt-") &&
              getMessageText(candidate) === getMessageText(message)
          )
        : -1;
    if (optimisticIndex === -1) {
      return { ...state, messages: [...state.messages, message] };
    }
    const messages = [...state.messages];
    messages[optimisticIndex] = message;
    return { ...state, messages };
  }
  const messages = [...state.messages];
  messages[index] = message;
  return { ...state, messages };
}

function getMessageText(message: AgentMessage): string {
  if (!("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("");
}

function mergeAssistantDelta(
  state: AgentTaskState,
  messageId: string,
  delta: Record<string, unknown>
): AgentTaskState {
  const index = state.messages.findIndex((message) => message.id === messageId);
  const message = state.messages[index];
  if (!message || message.role !== "assistant") return state;
  const contentIndex = typeof delta.contentIndex === "number" ? delta.contentIndex : 0;
  const content = [...message.content];
  const type = delta.type;

  if (type === "text_start") content[contentIndex] = { text: "", type: "text" };
  if (type === "thinking_start") {
    content[contentIndex] = { thinking: "", type: "thinking" };
  }
  if (type === "text_delta" && typeof delta.delta === "string") {
    content[contentIndex] = appendText(content[contentIndex], delta.delta);
  }
  if (type === "thinking_delta" && typeof delta.delta === "string") {
    content[contentIndex] = appendThinking(content[contentIndex], delta.delta);
  }

  const messages = [...state.messages];
  messages[index] = { ...message, content };
  return { ...state, messages };
}

function appendText(value: AssistantMessage["content"][number] | undefined, delta: string): TextContent {
  return { text: (value?.type === "text" ? value.text : "") + delta, type: "text" };
}

function appendThinking(
  value: AssistantMessage["content"][number] | undefined,
  delta: string
): ThinkingContent {
  return {
    thinking: (value?.type === "thinking" ? value.thinking : "") + delta,
    type: "thinking"
  };
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getPendingApproval(
  value: Record<string, unknown> | undefined
): PendingApproval | undefined {
  if (
    typeof value?.agentId !== "string" ||
    typeof value.approvalId !== "string" ||
    (value.title !== undefined && typeof value.title !== "string")
  ) {
    return undefined;
  }
  const tool = getRecord(value.tool);
  if (
    typeof tool?.name !== "string" ||
    typeof tool.toolCallId !== "string" ||
    (tool.description !== undefined && typeof tool.description !== "string") ||
    (tool.label !== undefined && typeof tool.label !== "string")
  ) {
    return undefined;
  }
  return {
    agentId: value.agentId,
    approvalId: value.approvalId,
    ...(value.title === undefined ? {} : { title: value.title }),
    tool: {
      ...(tool.description === undefined ? {} : { description: tool.description }),
      input: tool.input,
      ...(tool.label === undefined ? {} : { label: tool.label }),
      name: tool.name,
      toolCallId: tool.toolCallId
    }
  };
}
