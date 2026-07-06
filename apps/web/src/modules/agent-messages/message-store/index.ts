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
  readonly ids: string[];
  readonly messages: WebPlugin.AgentMessage[];
  readonly messagesById: Map<string, WebPlugin.AgentMessage>;
  readonly toolResultIdByToolCallId: Map<string, string>;
}

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
    const previous = getSnapshot(taskId);
    const next = createSnapshot(messages);

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
      const messages = getSnapshot(taskId).messages;

      setTaskMessages(taskId, [
        ...messages,
        {
          content: [{ text: prompt, type: "text" }],
          id: `prompt-${messages.length}`,
          role: "user",
          timestamp: Date.now()
        }
      ]);
    },
    getTaskMessage: (taskId, messageId) =>
      getSnapshot(taskId).messagesById.get(messageId),
    getTaskMessageIds: (taskId) => getSnapshot(taskId).ids,
    getTaskMessages: (taskId) => {
      return getSnapshot(taskId).messages;
    },
    getToolResult: (taskId, toolCallId) => {
      const snapshot = getSnapshot(taskId);
      const resultId = snapshot.toolResultIdByToolCallId.get(toolCallId);
      const message = resultId ? snapshot.messagesById.get(resultId) : undefined;

      return message?.role === "toolResult" ? message : undefined;
    },
    reduceTaskEvent: (taskId, event) => {
      if (!isMessageEvent(event.type)) return;
      setTaskMessages(
        taskId,
        reduceAgentMessages(
          getSnapshot(taskId).messages,
          event
        )
      );
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
    ids: messages.map((message) => message.id),
    messages,
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

  if (!areIdsEqual(previous.ids, next.ids)) {
    notify(taskIdsListeners, taskId);
  }

  for (const id of new Set([...previous.ids, ...next.ids])) {
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
