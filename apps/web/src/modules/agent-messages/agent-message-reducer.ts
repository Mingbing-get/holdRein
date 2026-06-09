import type {
  AgentEventEnvelope,
  AgentMessage,
  AgentTaskState
} from "./agent-message-types";

export type AgentTaskAction =
  | { prompt: string; type: "prompt_submitted" }
  | { event: AgentEventEnvelope; type: "event_received" }
  | { message: string; type: "subscription_failed" };

const MESSAGE_BOUNDARY_EVENT_TYPES = new Set([
  "agent_start",
  "agent_end",
  "message_start",
  "message_end",
  "turn_start",
  "turn_end"
]);

const NON_RENDERABLE_EVENT_TYPES = new Set([
  ...MESSAGE_BOUNDARY_EVENT_TYPES,
  "abort",
  "after_provider_response",
  "before_agent_start",
  "before_provider_payload",
  "before_provider_request",
  "context",
  "model_select",
  "queue_update",
  "resources_update",
  "save_point",
  "session_before_compact",
  "session_before_tree",
  "session_compact",
  "session_tree",
  "settled",
  "thinking_level_select",
  "tool_call",
  "tool_result"
]);

export function createInitialAgentTaskState(taskId: string): AgentTaskState {
  return {
    activeMessageId: null,
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
      activeMessageId: null,
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
      activeMessageId: null,
      error: action.message,
      status: "error"
    };
  }

  const eventState = {
    ...state,
    lastSequence: Math.max(state.lastSequence, action.event.sequence)
  };

  if (isMessageBoundary(action.event)) {
    return {
      ...eventState,
      activeMessageId: null
    };
  }

  const message = normalizeEvent(action.event);

  if (!message) {
    return eventState;
  }

  if (action.event.type === "message_update" && state.activeMessageId) {
    const activeMessageIndex = state.messages.findIndex(
      (candidate) => candidate.id === state.activeMessageId
    );
    const activeMessage = state.messages[activeMessageIndex];

    if (activeMessage?.kind === message.kind) {
      const messages = [...state.messages];
      messages[activeMessageIndex] = {
        ...message,
        content: activeMessage.content + message.content,
        id: activeMessage.id
      };

      return {
        ...eventState,
        messages
      };
    }
  }

  return {
    ...eventState,
    activeMessageId:
      action.event.type === "message_update" ? message.id : null,
    error: action.event.type === "agent_error" ? message.content : state.error,
    messages: [...state.messages, message],
    status: action.event.type === "agent_error" ? "error" : state.status
  };
}

function normalizeEvent(event: AgentEventEnvelope): AgentMessage | null {
  if (NON_RENDERABLE_EVENT_TYPES.has(event.type)) return null;

  const kind = getEventKind(event);
  const content =
    event.type === "message_update"
      ? getMessageUpdateContent(event.payload)
      : getEventContent(event.payload, event.type);

  if (content === null) return null;

  return createMessage(
    kind,
    content,
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

function getEventKind(event: AgentEventEnvelope): AgentMessage["kind"] {
  const type = event.type;
  const updateType = getRecord(getRecord(event.payload)?.assistantMessageEvent)
    ?.type;

  if (updateType === "thinking_delta") return "thinking";
  if (updateType === "toolcall_delta") return "tool";
  if (type === "message_update") return "assistant";
  if (type.includes("thinking") || type.includes("reasoning")) return "thinking";
  if (type.startsWith("tool_")) return "tool";
  if (type === "approval_requested") return "approval";
  if (type === "agent_error") return "error";
  return "fallback";
}

function getMessageUpdateContent(payload: unknown): string | null {
  const update = getRecord(getRecord(payload)?.assistantMessageEvent);

  if (update) {
    const updateType = update.type;
    if (typeof updateType === "string" && updateType.endsWith("_delta")) {
      return typeof update.delta === "string" ? update.delta : null;
    }
    return null;
  }

  return getEventContent(payload, "message_update");
}

function isMessageBoundary(event: AgentEventEnvelope): boolean {
  if (MESSAGE_BOUNDARY_EVENT_TYPES.has(event.type)) return true;
  if (event.type !== "message_update") return false;

  const updateType = getRecord(getRecord(event.payload)?.assistantMessageEvent)
    ?.type;
  return (
    typeof updateType === "string" &&
    (updateType.endsWith("_start") || updateType.endsWith("_end"))
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
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
