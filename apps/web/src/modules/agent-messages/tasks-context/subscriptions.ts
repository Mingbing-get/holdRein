import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { fetchTaskMessages } from "../api";
import type { AgentMessageFetcher } from "../api";
import type { AgentMessageStore } from "../message-store";
import {
  getAgentEventMessage,
  startAgentEventSubscription
} from "../agent-event-subscription";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "../reducer";
import {
  discoverSubagents,
  hasCalledSubagents,
  initializeSubagentsFromHistory,
  isSubagentLifecycleEvent,
  reduceSubagentEvent
} from "../subagent-message/store";
import type {
  AgentEventEnvelope,
  AgentTaskState,
  SubagentStatesById
} from "../agent-message-types";
import type {
  WorkspaceSummary,
  WorkspaceTaskSummary
} from "../../leftSide/workspace-nav-types";

type RunningWorkspaceTask = WorkspaceTaskSummary & {
  activeAgentId: string;
  status: "running";
};

interface RefValue<T> {
  current: T;
}

interface UseAgentTaskSubscriptionsInput {
  readonly activeTaskId: string;
  readonly apiBaseUrl: string;
  readonly fetcher: AgentMessageFetcher;
  readonly handleTaskEvent: (taskId: string, event: AgentEventEnvelope) => void;
  readonly handleTaskSubscriptionError: (taskId: string, error: unknown) => void;
  readonly loadedTaskIds: RefValue<Set<string>>;
  readonly messageStore: AgentMessageStore;
  readonly setSubagentMessagesById: Dispatch<SetStateAction<SubagentStatesById>>;
  readonly setTaskStates: Dispatch<SetStateAction<Record<string, AgentTaskState>>>;
  readonly subagentMessagesById: SubagentStatesById;
  readonly subscriptions: RefValue<Map<string, AbortController>>;
  readonly taskStates: Record<string, AgentTaskState>;
  readonly workspaces: WorkspaceSummary[];
}

export function useAgentTaskSubscriptions(
  input: UseAgentTaskSubscriptionsInput
): void {
  const {
    activeTaskId,
    apiBaseUrl,
    fetcher,
    handleTaskEvent,
    handleTaskSubscriptionError,
    loadedTaskIds,
    messageStore,
    setSubagentMessagesById,
    setTaskStates,
    subagentMessagesById,
    subscriptions,
    taskStates,
    workspaces
  } = input;

  useEffect(
    () => () => {
      for (const controller of subscriptions.current.values()) {
        controller.abort();
      }
      subscriptions.current.clear();
    },
    [subscriptions]
  );

  useEffect(() => {
    if (!activeTaskId || loadedTaskIds.current.has(activeTaskId)) return;
    if (messageStore.getAgentMessageIds(activeTaskId).length) {
      loadedTaskIds.current.add(activeTaskId);
      return;
    }
    loadedTaskIds.current.add(activeTaskId);

    void fetchTaskMessages(apiBaseUrl, activeTaskId, fetcher)
      .then((history) => {
        messageStore.replaceAgentMessages(activeTaskId, history.messages);
        for (const subagent of history.subagents) {
          messageStore.replaceAgentMessages(subagent.agentId, subagent.messages);
        }
        if (history.subagents.length || hasCalledSubagents(history.messages)) {
          setSubagentMessagesById((current) =>
            discoverSubagents(
              initializeSubagentsFromHistory(
                current,
                history.subagents,
                activeTaskId
              ),
              history.messages,
              activeTaskId
            )
          );
        }
      })
      .catch(() => {
        loadedTaskIds.current.delete(activeTaskId);
      });
  }, [
    activeTaskId,
    apiBaseUrl,
    fetcher,
    loadedTaskIds,
    messageStore,
    setSubagentMessagesById,
    setTaskStates,
    taskStates,
    workspaces
  ]);

  useEffect(() => {
    const runningTasks = workspaces
      .flatMap((workspace) => workspace.tasks)
      .filter(isRunningWorkspaceTask);

    setTaskStates((current) => {
      let changed = false;
      const next = { ...current };

      for (const task of runningTasks) {
        if (next[task.id]?.status === "running") {
          continue;
        }
        changed = true;
        next[task.id] = {
          ...(next[task.id] ?? createInitialAgentTaskState(task.id)),
          status: "running"
        };
      }

      return changed ? next : current;
    });

    for (const task of runningTasks) {
      if (
        subscriptions.current.has(task.activeAgentId)
      ) {
        continue;
      }

      startAgentEventSubscription({
        agentId: task.activeAgentId,
        apiBaseUrl,
        fetcher,
        onError: (error) => handleTaskSubscriptionError(task.id, error),
        onEvent: (event) => handleTaskEvent(task.id, event),
        subscriptions
      });
    }
  }, [
    apiBaseUrl,
    fetcher,
    handleTaskEvent,
    handleTaskSubscriptionError,
    subscriptions,
    workspaces
  ]);

  useEffect(() => {
    for (const [agentId, subagent] of Object.entries(subagentMessagesById)) {
      if (subagent.status !== "running") continue;
      if (subscriptions.current.has(agentId)) continue;
      startAgentEventSubscription({
        agentId,
        apiBaseUrl,
        fetcher,
        onError: () => undefined,
        onEvent: (event) => {
          const message = getAgentEventMessage(event);
          const shouldDiscoverSubagents =
            message ? hasCalledSubagents([message]) : false;
          const shouldReduceSubagentStatus =
            event.agentId === agentId && isSubagentLifecycleEvent(event.type);

          if (isMessageEvent(event.type)) {
            messageStore.reduceAgentEvent(agentId, event);
          }
          if (shouldDiscoverSubagents || shouldReduceSubagentStatus) {
            setSubagentMessagesById((current) => {
              const next = shouldReduceSubagentStatus
                ? reduceSubagentEvent(current, agentId, event)
                : current;
              return shouldDiscoverSubagents && message
                ? discoverSubagents(next, [message], subagent.taskId)
                : next;
            });
          }
          if (event.type === "approval_requested" && subagent.taskId) {
            setTaskStates((current) => ({
              ...current,
              [subagent.taskId]: reduceAgentTaskState(
                current[subagent.taskId] ??
                  createInitialAgentTaskState(subagent.taskId),
                { event, type: "event_received" }
              )
            }));
          }
        },
        subscriptions
      });
    }
  }, [
    apiBaseUrl,
    fetcher,
    messageStore,
    setSubagentMessagesById,
    setTaskStates,
    subagentMessagesById,
    subscriptions
  ]);
}

function isRunningWorkspaceTask(
  task: WorkspaceTaskSummary
): task is RunningWorkspaceTask {
  return task.status === "running" && Boolean(task.activeAgentId);
}

function isMessageEvent(type: string): boolean {
  return (
    type === "message_start" ||
    type === "message_delta" ||
    type === "message_end"
  );
}
