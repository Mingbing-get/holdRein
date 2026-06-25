import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { PropsWithChildren } from "react";

import { useAppWorkspace } from "../../../app/app-workspace-context";
import { getActiveAgentId } from "../agent-task-workspace-utils";
import {
  cancelAgentTask,
  continueAgentTask,
  decideAgentApproval,
  fetchTaskMessages,
  fetchTaskTitle,
  startAgentTask
} from "../api";
import type { AgentMessageFetcher } from "../api";
import {
  getAgentEventMessage,
  startAgentEventSubscription
} from "../agent-event-subscription";
import { handleBrowserToolEvent } from "../browser-tool-events";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "../reducer";
import { discoverSubagents, initializeSubagentsFromHistory, reduceSubagentEvent, reduceSubagentResumeEvent } from "../subagent-message/store";
import type {
  AgentEventEnvelope,
  AgentTaskState,
  ContinueTaskInput,
  PendingApproval,
  StartTaskInput,
  SubagentStatesById
} from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

const EMPTY_MESSAGES: WebPlugin.AgentMessage[] = [];

export interface AgentTasksContextValue {
  cancelTask: (taskId: string) => Promise<void>;
  continueTask: (taskId: string, input: ContinueTaskInput) => Promise<void>;
  decideApproval: (
    taskId: string,
    approvalId: string,
    approved: boolean,
    reason?: string
  ) => Promise<void>;
  getSubagentMessages: (agentId: string) => WebPlugin.AgentMessage[];
  getSubagentStatus: (
    agentId: string
  ) => SubagentStatesById[string]["status"] | undefined;
  getPendingApproval: (taskId: string) => PendingApproval | undefined;
  getTaskState: (taskId: string) => AgentTaskState | undefined;
  hasPendingApproval: (taskId: string) => boolean;
  hasUnreadCompletion: (taskId: string) => boolean;
  startTask: (input: StartTaskInput) => Promise<void>;
}

export interface AgentTasksProviderProps extends PropsWithChildren {
  apiBaseUrl: string;
  fetcher?: AgentMessageFetcher;
}

const AgentTasksContext = createContext<AgentTasksContextValue | null>(null);

export function AgentTasksProvider({
  apiBaseUrl,
  children,
  fetcher = fetch
}: AgentTasksProviderProps) {
  const {
    state: { activeTaskId, workspaces },
    updateTaskStatus,
    updateTaskTitle,
    upsertStartedTask
  } = useAppWorkspace();
  const [taskStates, setTaskStates] = useState<Record<string, AgentTaskState>>(
    {}
  );
  const [subagentMessagesById, setSubagentMessagesById] =
    useState<SubagentStatesById>({});
  const subscriptions = useRef(new Map<string, AbortController>());
  const loadedTaskIds = useRef(new Set<string>());
  const activeTaskIdRef = useRef(activeTaskId);
  const [unreadCompletionTaskIds, setUnreadCompletionTaskIds] = useState<
    Set<string>
  >(() => new Set());

  useEffect(() => {
    activeTaskIdRef.current = activeTaskId;
    if (!activeTaskId) return;

    setUnreadCompletionTaskIds((current) => {
      if (!current.has(activeTaskId)) return current;
      const next = new Set(current);
      next.delete(activeTaskId);
      return next;
    });
  }, [activeTaskId]);

  useEffect(
    () => () => {
      for (const controller of subscriptions.current.values()) {
        controller.abort();
      }
      subscriptions.current.clear();
    },
    []
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
  }, [activeTaskId, apiBaseUrl, fetcher, taskStates]);

  const handleTaskStatus = useCallback(
    (taskId: string, status: "completed" | "error") => {
      updateTaskStatus(taskId, status);
      if (status !== "completed" || activeTaskIdRef.current === taskId) {
        return;
      }
      setUnreadCompletionTaskIds((current) => new Set(current).add(taskId));
    },
    [updateTaskStatus]
  );

  const handleTaskEvent = useCallback(
    (taskId: string, event: AgentEventEnvelope) => {
      setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          { event, type: "event_received" }
        )
      }));
      const message = getAgentEventMessage(event);
      if (message) {
        setSubagentMessagesById((current) =>
          discoverSubagents(current, [message], taskId)
        );
      }
      if (event.type === "subagent_resumed") {
        setSubagentMessagesById((current) => reduceSubagentResumeEvent(current, event, taskId));
      }
      handleBrowserToolEvent({ apiBaseUrl, event, fetcher, taskId });
      if (event.type === "task_end") handleTaskStatus(taskId, "completed");
      if (event.type === "agent_error") handleTaskStatus(taskId, "error");
    },
    [apiBaseUrl, fetcher, handleTaskStatus]
  );

  const handleTaskSubscriptionError = useCallback(
    (taskId: string, error: unknown) => {
      setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          {
            message:
              error instanceof Error ? error.message : "Subscription failed",
            type: "subscription_failed"
          }
        )
      }));
      handleTaskStatus(taskId, "error");
    },
    [handleTaskStatus]
  );

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
  }, [apiBaseUrl, fetcher, subagentMessagesById]);

  const startTask = useCallback(
    async (input: StartTaskInput) => {
      const result = await startAgentTask(apiBaseUrl, input, fetcher);
      const taskId = result.task.id;

      upsertStartedTask(
        result.workspace,
        { ...result.task, activeAgentId: result.agentId },
        input.prompt
      );
      setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          { prompt: input.prompt, type: "prompt_submitted" }
        )
      }));

      startAgentEventSubscription({
        agentId: result.agentId,
        apiBaseUrl,
        fetcher,
        onError: (error) => handleTaskSubscriptionError(taskId, error),
        onEvent: (event) => handleTaskEvent(taskId, event),
        subscriptions
      });

      void fetchTaskTitle(apiBaseUrl, taskId, fetcher)
        .then((titleResult) => {
          updateTaskTitle(titleResult.id, titleResult.title);
        })
        .catch(() => undefined);
    },
    [
      apiBaseUrl,
      fetcher,
      handleTaskEvent,
      handleTaskSubscriptionError,
      updateTaskTitle,
      upsertStartedTask
    ]
  );

  const continueTask = useCallback(
    async (taskId: string, input: ContinueTaskInput) => {
      const result = await continueAgentTask(apiBaseUrl, taskId, input, fetcher);
      updateTaskStatus(taskId, "running", result.agentId);
      setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          { prompt: input.prompt, type: "prompt_submitted" }
        )
      }));
      startAgentEventSubscription({
        agentId: result.agentId,
        apiBaseUrl,
        fetcher,
        onError: (error) => handleTaskSubscriptionError(taskId, error),
        onEvent: (event) => handleTaskEvent(taskId, event),
        subscriptions
      });
    },
    [
      apiBaseUrl,
      fetcher,
      handleTaskEvent,
      handleTaskSubscriptionError,
      updateTaskStatus
    ]
  );

  const cancelTask = useCallback(
    async (taskId: string) => {
      const activeAgentId = getActiveAgentId(workspaces, taskId);

      await cancelAgentTask(apiBaseUrl, taskId, fetcher);

      if (activeAgentId) {
        subscriptions.current.get(activeAgentId)?.abort();
        subscriptions.current.delete(activeAgentId);
      }

      updateTaskStatus(taskId, "error");
      setTaskStates((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? createInitialAgentTaskState(taskId)),
          status: "error"
        }
      }));
    },
    [apiBaseUrl, fetcher, updateTaskStatus, workspaces]
  );

  const decideApproval = useCallback(
    async (
      taskId: string,
      approvalId: string,
      approved: boolean,
      reason?: string
    ) => {
      const approval = taskStates[taskId]?.pendingApprovals.find(
        (candidate) => candidate.approvalId === approvalId
      );
      if (!approval) {
        throw new Error("Unknown approval request");
      }
      await decideAgentApproval(
        apiBaseUrl,
        {
          agentId: approval.agentId,
          approvalId,
          approved,
          ...(reason === undefined ? {} : { reason })
        },
        fetcher
      );
      setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          { approvalId, type: "approval_decided" }
        )
      }));
    },
    [apiBaseUrl, fetcher, taskStates]
  );

  const contextValue = useMemo<AgentTasksContextValue>(
    () => ({
      cancelTask,
      continueTask,
      decideApproval,
      getPendingApproval: (taskId) => taskStates[taskId]?.pendingApprovals[0],
      getSubagentMessages: (agentId) =>
        subagentMessagesById[agentId]?.messages ?? EMPTY_MESSAGES,
      getSubagentStatus: (agentId) => subagentMessagesById[agentId]?.status,
      getTaskState: (taskId) => taskStates[taskId],
      hasPendingApproval: (taskId) =>
        Boolean(taskStates[taskId]?.pendingApprovals.length),
      hasUnreadCompletion: (taskId) => unreadCompletionTaskIds.has(taskId),
      startTask
    }),
    [
      cancelTask,
      continueTask,
      decideApproval,
      startTask,
      subagentMessagesById,
      taskStates,
      unreadCompletionTaskIds
    ]
  );

  return (
    <AgentTasksContext.Provider value={contextValue}>
      {children}
    </AgentTasksContext.Provider>
  );
}

export function useAgentTasks(): AgentTasksContextValue {
  const value = useContext(AgentTasksContext);

  if (!value) {
    throw new Error("useAgentTasks must be used within an AgentTasksProvider");
  }

  return value;
}
