import type {
  AgentEventEnvelope,
  AgentMessage,
  AgentTaskState
} from "./agent-message-types";

export type AgentTaskAction =
  | { prompt: string; type: "prompt_submitted" }
  | { event: AgentEventEnvelope; type: "event_received" }
  | { message: string; type: "subscription_failed" };

export function createInitialAgentTaskState(taskId: string): AgentTaskState {
  return {
    error: null,
    lastSequence: 0,
    messages: [],
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
        createMessage("user", action.prompt, `prompt-${state.messages.length}`)
      ],
      status: "running"
    };
  }

  if (action.type === "subscription_failed") {
    return {
      ...state,
      error: action.message,
      status: "error"
    };
  }

  const message = normalizeEvent(action.event);
  return {
    ...state,
    error: action.event.type === "agent_error" ? message.content : state.error,
    lastSequence: Math.max(state.lastSequence, action.event.sequence),
    messages: [...state.messages, message],
    status: action.event.type === "agent_error" ? "error" : state.status
  };
}

function normalizeEvent(event: AgentEventEnvelope): AgentMessage {
  const kind = getEventKind(event.type);
  return createMessage(
    kind,
    getEventContent(event.payload, event.type),
    `${event.agentId}-${event.sequence}`,
    event
  );
}

function createMessage(
  kind: AgentMessage["kind"],
  content: string,
  id: string,
  event?: AgentEventEnvelope
): AgentMessage {
  return {
    content,
    ...(event ? { eventType: event.type, payload: event.payload } : {}),
    id,
    kind
  };
}

function getEventKind(type: string): AgentMessage["kind"] {
  if (type === "message_update" || type === "message_end") return "assistant";
  if (type.includes("thinking") || type.includes("reasoning")) return "thinking";
  if (type.startsWith("tool_")) return "tool";
  if (type === "approval_requested") return "approval";
  if (type === "agent_error") return "error";
  return "fallback";
}

function getEventContent(payload: unknown, eventType: string): string {
  const text = findText(payload);
  if (text) return text;
  if (payload === undefined) return eventType;

  try {
    return JSON.stringify(payload);
  } catch {
    return eventType;
  }
}

function findText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;

  for (const key of ["delta", "text", "content", "message", "command", "toolName"]) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === "string" && entry) return entry;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    const nestedText = findText(entry);
    if (nestedText) return nestedText;
  }

  return undefined;
}
