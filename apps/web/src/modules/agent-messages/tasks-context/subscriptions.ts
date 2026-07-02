import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import { fetchTaskMessages } from "../api";
import type { AgentMessageFetcher } from "../api";
import { startAgentEventSubscription } from "../agent-event-subscription";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "../reducer";
import {
  discoverSubagents,
  initializeSubagentsFromHistory,
  reduceSubagentEvent
} from "../subagent-message/store";
import type {
  AgentEventEnvelope,
  AgentTaskState,
  SubagentStatesById
} from "../agent-message-types";
import type { WorkspaceSummary } from "../../leftSide/workspace-nav-types";

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
    if (taskStates[activeTaskId]?.messages.length) {
      loadedTaskIds.current.add(activeTaskId);
      return;
    }
    loadedTaskIds.current.add(activeTaskId);

    void fetchTaskMessages(apiBaseUrl, activeTaskId, fetcher)
      .then((history) => {
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
        setTaskStates((current) => ({
          ...current,
          [activeTaskId]: reduceAgentTaskState(
            current[activeTaskId] ?? createInitialAgentTaskState(activeTaskId),
            { messages: history.messages, type: "history_loaded" }
          )
        }));
      })
      .catch(() => {
        loadedTaskIds.current.delete(activeTaskId);
      });
  }, [
    activeTaskId,
    apiBaseUrl,
    fetcher,
    loadedTaskIds,
    setSubagentMessagesById,
    setTaskStates,
    taskStates
  ]);

  useEffect(() => {
    for (const task of workspaces.flatMap((workspace) => workspace.tasks)) {
      if (
        task.status !== "running" ||
        !task.activeAgentId ||
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
          setSubagentMessagesById((current) =>
            reduceSubagentEvent(current, agentId, event)
          );
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
    setSubagentMessagesById,
    setTaskStates,
    subagentMessagesById,
    subscriptions
  ]);
}
