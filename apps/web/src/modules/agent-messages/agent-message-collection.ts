import type {
  AgentEventEnvelope,
  ThinkingContent,
  TextContent
} from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function reduceAgentMessages(
  messages: WebPlugin.AgentMessage[],
  event: AgentEventEnvelope
): WebPlugin.AgentMessage[] {
  const payload = getRecord(event.payload);

  if (event.type === "message_start" || event.type === "message_end") {
    const message = payload?.message as WebPlugin.AgentMessage | undefined;
    return message ? upsertMessage(messages, message) : messages;
  }
  if (event.type !== "message_delta") return messages;

  const messageId = payload?.messageId;
  const delta = getRecord(payload?.delta);
  return typeof messageId === "string" && delta
    ? mergeAssistantDelta(messages, messageId, delta)
    : messages;
}

export function getCalledSubagentId(
  message: WebPlugin.AgentMessage
): string | undefined {
  if (message.role !== "custom" || message.customType !== "callsubagent") {
    return undefined;
  }
  const details = getRecord(message.details);
  return typeof details?.agentId === "string" ? details.agentId : undefined;
}

export function getCalledSubagentIds(
  messages: WebPlugin.AgentMessage[]
): string[] {
  return messages.flatMap((message) => {
    const agentId = getCalledSubagentId(message);
    return agentId ? [agentId] : [];
  });
}

function upsertMessage(
  messages: WebPlugin.AgentMessage[],
  message: WebPlugin.AgentMessage
): WebPlugin.AgentMessage[] {
  const index = messages.findIndex((candidate) => candidate.id === message.id);
  if (index === -1) {
    const optimisticIndex =
      message.role === "user"
        ? messages.findIndex(
            (candidate) =>
              candidate.role === "user" &&
              candidate.id.startsWith("prompt-") &&
              getMessageText(candidate) === getMessageText(message)
          )
        : -1;
    if (optimisticIndex === -1) return [...messages, message];
    const next = [...messages];
    next[optimisticIndex] = message;
    return next;
  }
  const next = [...messages];
  next[index] = message;
  return next;
}

function mergeAssistantDelta(
  messages: WebPlugin.AgentMessage[],
  messageId: string,
  delta: Record<string, unknown>
): WebPlugin.AgentMessage[] {
  const index = messages.findIndex((message) => message.id === messageId);
  const message = messages[index];
  if (!message || message.role !== "assistant") return messages;
  const contentIndex =
    typeof delta.contentIndex === "number" ? delta.contentIndex : 0;
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

  const next = [...messages];
  next[index] = { ...message, content };
  return next;
}

function getMessageText(message: WebPlugin.AgentMessage): string {
  if (!("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("");
}

function appendText(
  value: WebPlugin.AssistantMessage["content"][number] | undefined,
  delta: string
): TextContent {
  return {
    text: (value?.type === "text" ? value.text : "") + delta,
    type: "text"
  };
}

function appendThinking(
  value: WebPlugin.AssistantMessage["content"][number] | undefined,
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
