import { reduceAgentMessages } from "../collection";
import type { AgentEventEnvelope } from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

type Listener = () => void;

export interface AgentMessageStore {
  appendOptimisticPrompt: (agentId: string, prompt: string) => void;
  getAgentMessage: (
    agentId: string,
    messageId: string
  ) => WebPlugin.AgentMessage | undefined;
  getAgentMessageIds: (agentId: string) => string[];
  getAgentMessages: (agentId: string) => WebPlugin.AgentMessage[];
  getToolResult: (
    agentId: string,
    toolCallId: string
  ) => WebPlugin.ToolResultMessage | undefined;
  reduceAgentEvent: (agentId: string, event: AgentEventEnvelope) => void;
  replaceAgentMessages: (
    agentId: string,
    messages: WebPlugin.AgentMessage[]
  ) => void;
  subscribeAgentMessage: (
    agentId: string,
    messageId: string,
    listener: Listener
  ) => () => void;
  subscribeAgentMessageIds: (agentId: string, listener: Listener) => () => void;
  subscribeToolResult: (
    agentId: string,
    toolCallId: string,
    listener: Listener
  ) => () => void;
}

interface TaskMessagesSnapshot {
  readonly messagesById: Map<string, WebPlugin.AgentMessage>;
  readonly toolResultIdByToolCallId: Map<string, string>;
}

interface TaskMessagesSnapshotView {
  readonly ids: string[];
  readonly messages: WebPlugin.AgentMessage[];
}

const snapshotViews = new WeakMap<TaskMessagesSnapshot, TaskMessagesSnapshotView>();

export function createAgentMessageStore(): AgentMessageStore {
  const agentSnapshots = new Map<string, TaskMessagesSnapshot>();
  const agentIdsListeners = new Map<string, Set<Listener>>();
  const messageListeners = new Map<string, Set<Listener>>();
  const toolResultListeners = new Map<string, Set<Listener>>();
  const emptySnapshot = createSnapshot([]);

  const getSnapshot = (agentId: string): TaskMessagesSnapshot =>
    agentSnapshots.get(agentId) ?? emptySnapshot;

  const setAgentMessages = (
    agentId: string,
    messages: WebPlugin.AgentMessage[]
  ): void => {
    const next = createSnapshot(messages);
    const previous = getSnapshot(agentId);

    agentSnapshots.set(agentId, next);
    notifyChangedSubscriptions({
      agentId,
      agentIdsListeners,
      messageListeners,
      next,
      previous,
      toolResultListeners
    });
  };

  return {
    appendOptimisticPrompt: (agentId, prompt) => {
      const snapshot = getSnapshot(agentId);
      const message: WebPlugin.AgentMessage = {
        content: [{ text: prompt, type: "text" }],
        id: `prompt-${snapshot.messagesById.size}`,
        role: "user",
        timestamp: Date.now()
      };

      agentSnapshots.set(agentId, {
        ...snapshot,
        messagesById: new Map(snapshot.messagesById).set(message.id, message)
      });
      notify(agentIdsListeners, agentId);
    },
    getAgentMessage: (agentId, messageId) =>
      getSnapshot(agentId).messagesById.get(messageId),
    getAgentMessageIds: (agentId) => getSnapshotMessageIds(getSnapshot(agentId)),
    getAgentMessages: (agentId) => {
      return getSnapshotMessages(getSnapshot(agentId));
    },
    getToolResult: (agentId, toolCallId) => {
      const snapshot = getSnapshot(agentId);
      const resultId = snapshot.toolResultIdByToolCallId.get(toolCallId);
      const message = resultId ? snapshot.messagesById.get(resultId) : undefined;

      return message?.role === "toolResult" ? message : undefined;
    },
    reduceAgentEvent: (agentId, event) => {
      reduceAgentEvent({
        agentId,
        agentIdsListeners,
        agentSnapshots,
        event,
        messageListeners,
        toolResultListeners
      });
    },
    replaceAgentMessages: setAgentMessages,
    subscribeAgentMessage: (agentId, messageId, listener) =>
      subscribe(messageListeners, messageKey(agentId, messageId), listener),
    subscribeAgentMessageIds: (agentId, listener) =>
      subscribe(agentIdsListeners, agentId, listener),
    subscribeToolResult: (agentId, toolCallId, listener) =>
      subscribe(toolResultListeners, messageKey(agentId, toolCallId), listener)
  };
}

function createSnapshot(
  messages: WebPlugin.AgentMessage[]
): TaskMessagesSnapshot {
  return {
    messagesById: new Map(messages.map((message) => [message.id, message])),
    toolResultIdByToolCallId: new Map(
      messages.flatMap((message) =>
        message.role === "toolResult"
          ? [[message.toolCallId, message.id] as const]
          : []
      )
    )
  };
}

function getSnapshotMessageIds(snapshot: TaskMessagesSnapshot): string[] {
  return getSnapshotView(snapshot).ids;
}

function getSnapshotMessages(
  snapshot: TaskMessagesSnapshot
): WebPlugin.AgentMessage[] {
  return getSnapshotView(snapshot).messages;
}

function getSnapshotView(
  snapshot: TaskMessagesSnapshot
): TaskMessagesSnapshotView {
  const existing = snapshotViews.get(snapshot);
  if (existing) return existing;

  const view = {
    ids: Array.from(snapshot.messagesById.keys()),
    messages: Array.from(snapshot.messagesById.values())
  };

  snapshotViews.set(snapshot, view);
  return view;
}

function reduceAgentEvent(input: {
  readonly agentId: string;
  readonly agentIdsListeners: Map<string, Set<Listener>>;
  readonly agentSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly event: AgentEventEnvelope;
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const {
    agentId,
    agentIdsListeners,
    agentSnapshots,
    event,
    messageListeners,
    toolResultListeners
  } = input;

  if (!isMessageEvent(event.type)) return;

  if (event.type === "message_delta") {
    reduceMessageDelta({
      agentId,
      agentSnapshots,
      event,
      messageListeners
    });
    return;
  }

  const message = getEventMessage(event);
  if (!message) return;

  if (message.role === "toolResult") {
    storeToolResultMessage({
      agentId,
      agentSnapshots,
      message,
      toolResultListeners
    });
    return;
  }

  upsertTaskMessage({
    agentId,
    agentIdsListeners,
    agentSnapshots,
    message,
    messageListeners
  });
}

function reduceMessageDelta(input: {
  readonly agentId: string;
  readonly agentSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly event: AgentEventEnvelope;
  readonly messageListeners: Map<string, Set<Listener>>;
}): void {
  const { agentId, agentSnapshots, event, messageListeners } = input;
  const payload = getRecord(event.payload);
  const messageId = payload?.messageId;

  if (typeof messageId !== "string") return;

  const snapshot = agentSnapshots.get(agentId);
  const message = snapshot?.messagesById.get(messageId);
  if (!snapshot || !message || message.role !== "assistant") return;

  const nextMessage = reduceAgentMessages([message], event)[0];
  if (nextMessage === message || !nextMessage) return;

  const next = {
    ...snapshot,
    messagesById: new Map(snapshot.messagesById).set(messageId, nextMessage)
  };

  agentSnapshots.set(agentId, next);
  notify(messageListeners, messageKey(agentId, messageId));
}

function storeToolResultMessage(input: {
  readonly agentId: string;
  readonly agentSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly message: WebPlugin.ToolResultMessage;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const { agentId, agentSnapshots, message, toolResultListeners } = input;
  const snapshot = agentSnapshots.get(agentId) ?? createSnapshot([]);
  const previousResultId = snapshot.toolResultIdByToolCallId.get(
    message.toolCallId
  );
  const previousMessage = previousResultId
    ? snapshot.messagesById.get(previousResultId)
    : undefined;

  if (previousResultId === message.id && previousMessage === message) return;

  const messagesById = new Map(snapshot.messagesById).set(message.id, message);
  if (previousResultId && previousResultId !== message.id) {
    messagesById.delete(previousResultId);
  }
  const toolResultIdByToolCallId = new Map(
    snapshot.toolResultIdByToolCallId
  ).set(message.toolCallId, message.id);

  agentSnapshots.set(agentId, { messagesById, toolResultIdByToolCallId });
  notify(toolResultListeners, messageKey(agentId, message.toolCallId));
}

function upsertTaskMessage(input: {
  readonly agentId: string;
  readonly agentIdsListeners: Map<string, Set<Listener>>;
  readonly agentSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly message: WebPlugin.AgentMessage;
  readonly messageListeners: Map<string, Set<Listener>>;
}): void {
  const {
    agentId,
    agentIdsListeners,
    agentSnapshots,
    message,
    messageListeners
  } = input;
  const snapshot = agentSnapshots.get(agentId) ?? createSnapshot([]);
  const existing = snapshot.messagesById.get(message.id);

  if (existing) {
    if (existing === message) return;
    agentSnapshots.set(agentId, {
      ...snapshot,
      messagesById: new Map(snapshot.messagesById).set(message.id, message)
    });
    notify(messageListeners, messageKey(agentId, message.id));
    return;
  }

  const optimisticId = getOptimisticPromptId(snapshot, message);
  const messagesById = optimisticId
    ? replaceMapKey(snapshot.messagesById, optimisticId, message.id, message)
    : new Map(snapshot.messagesById).set(message.id, message);

  agentSnapshots.set(agentId, { ...snapshot, messagesById });
  notify(agentIdsListeners, agentId);
}

function getOptimisticPromptId(
  snapshot: TaskMessagesSnapshot,
  message: WebPlugin.AgentMessage
): string | undefined {
  if (message.role !== "user") return undefined;

  for (const candidate of snapshot.messagesById.values()) {
    if (
      candidate.role === "user" &&
      candidate.id.startsWith("prompt-") &&
      getMessageText(candidate) === getMessageText(message)
    ) {
      return candidate.id;
    }
  }

  return undefined;
}

function replaceMapKey<K, V>(
  map: Map<K, V>,
  previousKey: K,
  nextKey: K,
  nextValue: V
): Map<K, V> {
  return new Map(
    Array.from(map, ([key, value]) =>
      key === previousKey ? [nextKey, nextValue] : [key, value]
    )
  );
}

function getEventMessage(
  event: AgentEventEnvelope
): WebPlugin.AgentMessage | undefined {
  const message = getRecord(event.payload)?.message;

  return isAgentMessage(message) ? message : undefined;
}

function isAgentMessage(value: unknown): value is WebPlugin.AgentMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "role" in value
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getMessageText(message: WebPlugin.AgentMessage): string {
  if (!("content" in message)) return "";
  if (typeof message.content === "string") return message.content;
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("");
}

function notifyChangedSubscriptions(input: {
  readonly agentId: string;
  readonly agentIdsListeners: Map<string, Set<Listener>>;
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly next: TaskMessagesSnapshot;
  readonly previous: TaskMessagesSnapshot;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const {
    agentId,
    agentIdsListeners,
    messageListeners,
    next,
    previous,
    toolResultListeners
  } = input;

  const previousIds = getSnapshotMessageIds(previous);
  const nextIds = getSnapshotMessageIds(next);

  if (!areIdsEqual(previousIds, nextIds)) {
    notify(agentIdsListeners, agentId);
  }

  for (const id of new Set([...previousIds, ...nextIds])) {
    if (previous.messagesById.get(id) !== next.messagesById.get(id)) {
      notify(messageListeners, messageKey(agentId, id));
    }
  }

  for (const toolCallId of new Set([
    ...previous.toolResultIdByToolCallId.keys(),
    ...next.toolResultIdByToolCallId.keys()
  ])) {
    const previousResultId = previous.toolResultIdByToolCallId.get(toolCallId);
    const nextResultId = next.toolResultIdByToolCallId.get(toolCallId);

    if (
      previousResultId !== nextResultId ||
      previous.messagesById.get(previousResultId ?? "") !==
        next.messagesById.get(nextResultId ?? "")
    ) {
      notify(toolResultListeners, messageKey(agentId, toolCallId));
    }
  }
}

function subscribe(
  listenersByKey: Map<string, Set<Listener>>,
  key: string,
  listener: Listener
): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByKey.set(key, listeners);

  return () => {
    listeners.delete(listener);
    if (!listeners.size) listenersByKey.delete(key);
  };
}

function notify(listenersByKey: Map<string, Set<Listener>>, key: string): void {
  listenersByKey.get(key)?.forEach((listener) => {
    listener();
  });
}

function areIdsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function isMessageEvent(type: string): boolean {
  return (
    type === "message_start" ||
    type === "message_delta" ||
    type === "message_end"
  );
}

function messageKey(agentId: string, messageId: string): string {
  return `${agentId}:${messageId}`;
}
