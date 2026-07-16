import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { useOptionalAppPlugins } from "../../../app/app-plugin";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import {
  AgentTasksContext,
  EMPTY_RUNTIME_CONTRIBUTIONS
} from "./context";
import type {
  AgentTasksContextValue,
  AgentTasksProviderProps
} from "./context";
import { getActiveAgentId } from "../agent-task-workspace-utils";
import {
  cancelAgentTask,
  continueAgentTask,
  decideAgentApproval,
  fetchTaskTitle,
  startAgentTask
} from "../api";
import {
  getAgentEventMessage,
  startAgentEventSubscription
} from "../agent-event-subscription";
import { handleBrowserToolEvent } from "../browser-tool-events";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "../reducer";
import {
  mergeContinueTaskRuntimeContributions,
  mergeStartTaskRuntimeContributions
} from "./runtime-contributions";
import {
  decideLocalBrowserApproval,
  requestLocalBrowserApproval
} from "./local-browser-approval";
import type { LocalApprovalResolver } from "./local-browser-approval";
import { useAgentTaskSubscriptions } from "./subscriptions";
import {
  discoverSubagents,
  hasCalledSubagents,
  reduceSubagentResumeEvent
} from "../subagent-message/store";
import { createAgentMessageStore } from "../message-store";
import type {
  AgentEventEnvelope,
  AgentTaskState,
  ContinueTaskInput,
  PendingApproval,
  StartTaskInput,
  SubagentStatesById
} from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

export {
  useAgentTasks,
  useAgentMessage,
  useAgentMessageIds,
  useAgentMessages,
  useToolResultMessage
} from "./context";

export function AgentTasksProvider({
  apiBaseUrl,
  children,
  fetcher = fetch
}: AgentTasksProviderProps) {
  const {
    state: { activeTaskId, workspaceSettings, workspaces },
    updateTaskStatus,
    updateTaskTitle,
    upsertStartedTask
  } = useAppWorkspace();
  const appPlugins = useOptionalAppPlugins();
  const pluginRuntimeContributions =
    appPlugins?.runtimeContributions ?? EMPTY_RUNTIME_CONTRIBUTIONS;
  const [taskStates, setTaskStates] = useState<Record<string, AgentTaskState>>(
    {}
  );
  const [subagentMessagesById, setSubagentMessagesById] =
    useState<SubagentStatesById>({});
  const subscriptions = useRef(new Map<string, AbortController>());
  const messageStore = useRef(createAgentMessageStore());
  const localApprovalResolvers = useRef(new Map<string, LocalApprovalResolver>());
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

  const requestBrowserApproval = useCallback(
    (
      taskId: string,
      approval: PendingApproval
    ): Promise<WebPlugin.BrowserToolBeforeExecuteResult> => {
      return requestLocalBrowserApproval({
        approval,
        resolvers: localApprovalResolvers.current,
        setTaskStates,
        taskId
      });
    },
    []
  );

  const handleTaskEvent = useCallback(
    (taskId: string, event: AgentEventEnvelope) => {
      if (isMessageEvent(event.type)) {
        messageStore.current.reduceAgentEvent(taskId, event);
      } else {
        setTaskStates((current) => ({
          ...current,
          [taskId]: reduceAgentTaskState(
            current[taskId] ?? createInitialAgentTaskState(taskId),
            { event, type: "event_received" }
          )
        }));
      }
      const message = getAgentEventMessage(event);
      if (message && hasCalledSubagents([message])) {
        setSubagentMessagesById((current) =>
          discoverSubagents(current, [message], taskId)
        );
      }
      if (event.type === "subagent_resumed") {
        setSubagentMessagesById((current) => reduceSubagentResumeEvent(current, event, taskId));
      }
      handleBrowserToolEvent({
        apiBaseUrl,
        event,
        fetcher,
        requestApproval: (approval) =>
          requestBrowserApproval(taskId, approval),
        taskId
      });
      if (event.type === "task_end") handleTaskStatus(taskId, "completed");
      if (event.type === "agent_error") handleTaskStatus(taskId, "error");
    },
    [apiBaseUrl, fetcher, handleTaskStatus, requestBrowserApproval]
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

  useAgentTaskSubscriptions({
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
    workspaces,
    messageStore: messageStore.current
  });

  const startTask = useCallback(
    async (input: StartTaskInput) => {
      const requestInput = mergeStartTaskRuntimeContributions(input, pluginRuntimeContributions, { workspaceSettings, workspaces });
      const result = await startAgentTask(apiBaseUrl, requestInput, fetcher);
      const taskId = result.task.id;

      upsertStartedTask(
        result.workspace,
        { ...result.task, activeAgentId: result.agentId },
        input.prompt
      );
      messageStore.current.appendOptimisticPrompt(taskId, input.prompt);
      setTaskStates((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? createInitialAgentTaskState(taskId)),
          status: "running"
        }
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
      pluginRuntimeContributions,
      updateTaskTitle,
      upsertStartedTask,
      workspaceSettings,
      workspaces
    ]
  );

  const continueTask = useCallback(
    async (taskId: string, input: ContinueTaskInput) => {
      const requestInput = mergeContinueTaskRuntimeContributions(input, pluginRuntimeContributions, taskId, { workspaceSettings, workspaces });
      const result = await continueAgentTask(
        apiBaseUrl,
        taskId,
        requestInput,
        fetcher
      );
      updateTaskStatus(taskId, "running", result.agentId);
      messageStore.current.appendOptimisticPrompt(taskId, input.prompt);
      setTaskStates((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? createInitialAgentTaskState(taskId)),
          status: "running"
        }
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
      pluginRuntimeContributions,
      updateTaskStatus,
      workspaceSettings,
      workspaces
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
      if (
        decideLocalBrowserApproval({
          approval,
          approvalId,
          approved,
          ...(reason === undefined ? {} : { reason }),
          resolvers: localApprovalResolvers.current,
          setTaskStates,
          taskId
        })
      ) {
        return;
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
        messageStore.current.getAgentMessages(agentId),
      getSubagentStatus: (agentId) => subagentMessagesById[agentId]?.status,
      getTaskState: (taskId) => {
        const state = taskStates[taskId];

        return state;
      },
      hasPendingApproval: (taskId) =>
        Boolean(taskStates[taskId]?.pendingApprovals.length),
      hasUnreadCompletion: (taskId) => unreadCompletionTaskIds.has(taskId),
      messageStore: messageStore.current,
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

function isMessageEvent(type: string): boolean {
  return (
    type === "message_start" ||
    type === "message_delta" ||
    type === "message_end"
  );
}
