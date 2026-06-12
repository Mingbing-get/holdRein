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

import { useAppWorkspace } from "../../app/app-workspace-context";
import {
  continueAgentTask,
  decideAgentApproval,
  fetchTaskMessages,
  fetchTaskTitle,
  startAgentTask,
  subscribeToAgentEvents
} from "./agent-message-api";
import type { AgentMessageFetcher } from "./agent-message-api";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "./agent-message-reducer";
import type {
  AgentTaskState,
  ContinueTaskInput,
  PendingApproval,
  StartTaskInput,
  StartTaskResult
} from "./agent-message-types";

export interface AgentTasksContextValue {
  continueTask: (taskId: string, input: ContinueTaskInput) => Promise<void>;
  decideApproval: (
    taskId: string,
    approvalId: string,
    approved: boolean,
    reason?: string
  ) => Promise<void>;
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
      .then((messages) => {
        setTaskStates((current) => ({
          ...current,
          [activeTaskId]: reduceAgentTaskState(
            current[activeTaskId] ?? createInitialAgentTaskState(activeTaskId),
            { messages, type: "history_loaded" }
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

  useEffect(() => {
    for (const task of workspaces.flatMap((workspace) => workspace.tasks)) {
      if (
        task.status !== "running" ||
        !task.activeAgentId ||
        subscriptions.current.has(task.activeAgentId)
      ) {
        continue;
      }

      startSubscription({
        agentId: task.activeAgentId,
        apiBaseUrl,
        fetcher,
        onTaskStatus: handleTaskStatus,
        setTaskStates,
        subscriptions,
        taskId: task.id
      });
    }
  }, [apiBaseUrl, fetcher, handleTaskStatus, workspaces]);

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
        [taskId]: addRun(
          reduceAgentTaskState(
            current[taskId] ?? createInitialAgentTaskState(taskId),
            { prompt: input.prompt, type: "prompt_submitted" }
          ),
          result
        )
      }));

      startSubscription({
        agentId: result.agentId,
        apiBaseUrl,
        fetcher,
        onTaskStatus: handleTaskStatus,
        setTaskStates,
        subscriptions,
        taskId
      });

      void fetchTaskTitle(apiBaseUrl, taskId, fetcher)
        .then((titleResult) => {
          updateTaskTitle(titleResult.id, titleResult.title);
        })
        .catch(() => undefined);
    },
    [apiBaseUrl, fetcher, handleTaskStatus, updateTaskTitle, upsertStartedTask]
  );

  const continueTask = useCallback(
    async (taskId: string, input: ContinueTaskInput) => {
      const result = await continueAgentTask(apiBaseUrl, taskId, input, fetcher);
      updateTaskStatus(taskId, "running", result.agentId);
      setTaskStates((current) => ({
        ...current,
        [taskId]: addRun(
          reduceAgentTaskState(
            current[taskId] ?? createInitialAgentTaskState(taskId),
            { prompt: input.prompt, type: "prompt_submitted" }
          ),
          result
        )
      }));
      startSubscription({
        agentId: result.agentId,
        apiBaseUrl,
        fetcher,
        onTaskStatus: handleTaskStatus,
        setTaskStates,
        subscriptions,
        taskId
      });
    },
    [apiBaseUrl, fetcher, handleTaskStatus, updateTaskStatus]
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
      continueTask,
      decideApproval,
      getPendingApproval: (taskId) => taskStates[taskId]?.pendingApprovals[0],
      getTaskState: (taskId) => taskStates[taskId],
      hasPendingApproval: (taskId) =>
        Boolean(taskStates[taskId]?.pendingApprovals.length),
      hasUnreadCompletion: (taskId) => unreadCompletionTaskIds.has(taskId),
      startTask
    }),
    [
      continueTask,
      decideApproval,
      startTask,
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

function addRun(state: AgentTaskState, result: StartTaskResult): AgentTaskState {
  return {
    ...state,
    runs: [
      ...state.runs,
      {
        agentId: result.agentId,
        sessionId: result.sessionId,
        status: result.status
      }
    ],
    status: "running"
  };
}

function startSubscription(input: {
  agentId: string;
  apiBaseUrl: string;
  fetcher: AgentMessageFetcher;
  onTaskStatus: (taskId: string, status: "completed" | "error") => void;
  setTaskStates: React.Dispatch<
    React.SetStateAction<Record<string, AgentTaskState>>
  >;
  subscriptions: React.RefObject<Map<string, AbortController>>;
  taskId: string;
}): void {
  const controller = new AbortController();
  input.subscriptions.current.set(input.agentId, controller);

  void subscribeToAgentEvents(
    input.apiBaseUrl,
    { agentId: input.agentId, signal: controller.signal },
    (event) => {
      input.setTaskStates((current) => ({
        ...current,
        [input.taskId]: reduceAgentTaskState(
          current[input.taskId] ?? createInitialAgentTaskState(input.taskId),
          { event, type: "event_received" }
        )
      }));
      if (event.type === "agent_end") {
        input.onTaskStatus(input.taskId, "completed");
      }
      if (event.type === "agent_error") {
        input.onTaskStatus(input.taskId, "error");
      }
    },
    input.fetcher
  )
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      input.setTaskStates((current) => ({
        ...current,
        [input.taskId]: reduceAgentTaskState(
          current[input.taskId] ?? createInitialAgentTaskState(input.taskId),
          {
            message:
              error instanceof Error ? error.message : "Subscription failed",
            type: "subscription_failed"
          }
        )
      }));
      input.onTaskStatus(input.taskId, "error");
    })
    .finally(() => {
      input.subscriptions.current.delete(input.agentId);
    });
}
