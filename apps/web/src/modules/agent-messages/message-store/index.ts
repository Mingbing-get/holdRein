import { reduceAgentMessages } from "../collection";
import type { AgentEventEnvelope } from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

type Listener = () => void;

export interface AgentMessageStore {
  appendOptimisticPrompt: (taskId: string, prompt: string) => void;
  getTaskMessage: (
    taskId: string,
    messageId: string
  ) => WebPlugin.AgentMessage | undefined;
  getTaskMessageIds: (taskId: string) => string[];
  getTaskMessages: (taskId: string) => WebPlugin.AgentMessage[];
  getToolResult: (
    taskId: string,
    toolCallId: string
  ) => WebPlugin.ToolResultMessage | undefined;
  reduceTaskEvent: (taskId: string, event: AgentEventEnvelope) => void;
  replaceTaskMessages: (
    taskId: string,
    messages: WebPlugin.AgentMessage[]
  ) => void;
  subscribeTaskMessage: (
    taskId: string,
    messageId: string,
    listener: Listener
  ) => () => void;
  subscribeTaskMessageIds: (taskId: string, listener: Listener) => () => void;
  subscribeToolResult: (
    taskId: string,
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
  const taskSnapshots = new Map<string, TaskMessagesSnapshot>();
  const taskIdsListeners = new Map<string, Set<Listener>>();
  const messageListeners = new Map<string, Set<Listener>>();
  const toolResultListeners = new Map<string, Set<Listener>>();
  const emptySnapshot = createSnapshot([]);

  const getSnapshot = (taskId: string): TaskMessagesSnapshot =>
    taskSnapshots.get(taskId) ?? emptySnapshot;

  const setTaskMessages = (
    taskId: string,
    messages: WebPlugin.AgentMessage[]
  ): void => {
    const next = createSnapshot(messages);
    const previous = getSnapshot(taskId);

    taskSnapshots.set(taskId, next);
    notifyChangedSubscriptions({
      messageListeners,
      next,
      previous,
      taskId,
      taskIdsListeners,
      toolResultListeners
    });
  };

  return {
    appendOptimisticPrompt: (taskId, prompt) => {
      const snapshot = getSnapshot(taskId);
      const message: WebPlugin.AgentMessage = {
        content: [{ text: prompt, type: "text" }],
        id: `prompt-${snapshot.messagesById.size}`,
        role: "user",
        timestamp: Date.now()
      };

      taskSnapshots.set(taskId, {
        ...snapshot,
        messagesById: new Map(snapshot.messagesById).set(message.id, message)
      });
      notify(taskIdsListeners, taskId);
    },
    getTaskMessage: (taskId, messageId) =>
      getSnapshot(taskId).messagesById.get(messageId),
    getTaskMessageIds: (taskId) => getTaskMessageIds(getSnapshot(taskId)),
    getTaskMessages: (taskId) => {
      return getTaskMessages(getSnapshot(taskId));
    },
    getToolResult: (taskId, toolCallId) => {
      const snapshot = getSnapshot(taskId);
      const resultId = snapshot.toolResultIdByToolCallId.get(toolCallId);
      const message = resultId ? snapshot.messagesById.get(resultId) : undefined;

      return message?.role === "toolResult" ? message : undefined;
    },
    reduceTaskEvent: (taskId, event) => {
      reduceTaskEvent({
        event,
        messageListeners,
        taskId,
        taskIdsListeners,
        taskSnapshots,
        toolResultListeners
      });
    },
    replaceTaskMessages: setTaskMessages,
    subscribeTaskMessage: (taskId, messageId, listener) =>
      subscribe(messageListeners, messageKey(taskId, messageId), listener),
    subscribeTaskMessageIds: (taskId, listener) =>
      subscribe(taskIdsListeners, taskId, listener),
    subscribeToolResult: (taskId, toolCallId, listener) =>
      subscribe(toolResultListeners, messageKey(taskId, toolCallId), listener)
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

function getTaskMessageIds(snapshot: TaskMessagesSnapshot): string[] {
  return getSnapshotView(snapshot).ids;
}

function getTaskMessages(
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

function reduceTaskEvent(input: {
  readonly event: AgentEventEnvelope;
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly taskId: string;
  readonly taskIdsListeners: Map<string, Set<Listener>>;
  readonly taskSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const {
    event,
    messageListeners,
    taskId,
    taskIdsListeners,
    taskSnapshots,
    toolResultListeners
  } = input;

  if (!isMessageEvent(event.type)) return;

  if (event.type === "message_delta") {
    reduceMessageDelta({
      event,
      messageListeners,
      taskId,
      taskSnapshots
    });
    return;
  }

  const message = getEventMessage(event);
  if (!message) return;

  if (message.role === "toolResult") {
    storeToolResultMessage({
      message,
      taskId,
      taskSnapshots,
      toolResultListeners
    });
    return;
  }

  upsertTaskMessage({
    message,
    messageListeners,
    taskId,
    taskIdsListeners,
    taskSnapshots
  });
}

function reduceMessageDelta(input: {
  readonly event: AgentEventEnvelope;
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly taskId: string;
  readonly taskSnapshots: Map<string, TaskMessagesSnapshot>;
}): void {
  const { event, messageListeners, taskId, taskSnapshots } = input;
  const payload = getRecord(event.payload);
  const messageId = payload?.messageId;

  if (typeof messageId !== "string") return;

  const snapshot = taskSnapshots.get(taskId);
  const message = snapshot?.messagesById.get(messageId);
  if (!snapshot || !message || message.role !== "assistant") return;

  const nextMessage = reduceAgentMessages([message], event)[0];
  if (nextMessage === message || !nextMessage) return;

  const next = {
    ...snapshot,
    messagesById: new Map(snapshot.messagesById).set(messageId, nextMessage)
  };

  taskSnapshots.set(taskId, next);
  notify(messageListeners, messageKey(taskId, messageId));
}

function storeToolResultMessage(input: {
  readonly message: WebPlugin.ToolResultMessage;
  readonly taskId: string;
  readonly taskSnapshots: Map<string, TaskMessagesSnapshot>;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const { message, taskId, taskSnapshots, toolResultListeners } = input;
  const snapshot = taskSnapshots.get(taskId) ?? createSnapshot([]);
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

  taskSnapshots.set(taskId, { messagesById, toolResultIdByToolCallId });
  notify(toolResultListeners, messageKey(taskId, message.toolCallId));
}

function upsertTaskMessage(input: {
  readonly message: WebPlugin.AgentMessage;
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly taskId: string;
  readonly taskIdsListeners: Map<string, Set<Listener>>;
  readonly taskSnapshots: Map<string, TaskMessagesSnapshot>;
}): void {
  const {
    message,
    messageListeners,
    taskId,
    taskIdsListeners,
    taskSnapshots
  } = input;
  const snapshot = taskSnapshots.get(taskId) ?? createSnapshot([]);
  const existing = snapshot.messagesById.get(message.id);

  if (existing) {
    if (existing === message) return;
    taskSnapshots.set(taskId, {
      ...snapshot,
      messagesById: new Map(snapshot.messagesById).set(message.id, message)
    });
    notify(messageListeners, messageKey(taskId, message.id));
    return;
  }

  const optimisticId = getOptimisticPromptId(snapshot, message);
  const messagesById = optimisticId
    ? replaceMapKey(snapshot.messagesById, optimisticId, message.id, message)
    : new Map(snapshot.messagesById).set(message.id, message);

  taskSnapshots.set(taskId, { ...snapshot, messagesById });
  notify(taskIdsListeners, taskId);
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
  readonly messageListeners: Map<string, Set<Listener>>;
  readonly next: TaskMessagesSnapshot;
  readonly previous: TaskMessagesSnapshot;
  readonly taskId: string;
  readonly taskIdsListeners: Map<string, Set<Listener>>;
  readonly toolResultListeners: Map<string, Set<Listener>>;
}): void {
  const {
    messageListeners,
    next,
    previous,
    taskId,
    taskIdsListeners,
    toolResultListeners
  } = input;

  const previousIds = getTaskMessageIds(previous);
  const nextIds = getTaskMessageIds(next);

  if (!areIdsEqual(previousIds, nextIds)) {
    notify(taskIdsListeners, taskId);
  }

  for (const id of new Set([...previousIds, ...nextIds])) {
    if (previous.messagesById.get(id) !== next.messagesById.get(id)) {
      notify(messageListeners, messageKey(taskId, id));
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
      notify(toolResultListeners, messageKey(taskId, toolCallId));
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

function messageKey(taskId: string, messageId: string): string {
  return `${taskId}:${messageId}`;
}
