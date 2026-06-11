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
  StartTaskInput,
  StartTaskResult
} from "./agent-message-types";

export interface AgentTasksContextValue {
  continueTask: (taskId: string, input: ContinueTaskInput) => Promise<void>;
  getTaskState: (taskId: string) => AgentTaskState | undefined;
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
    state: { activeTaskId },
    updateTaskTitle,
    upsertStartedTask
  } = useAppWorkspace();
  const [taskStates, setTaskStates] = useState<Record<string, AgentTaskState>>(
    {}
  );
  const subscriptions = useRef(new Map<string, AbortController>());
  const loadedTaskIds = useRef(new Set<string>());

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

  const startTask = useCallback(
    async (input: StartTaskInput) => {
      const result = await startAgentTask(apiBaseUrl, input, fetcher);
      const taskId = result.task.id;

      upsertStartedTask(result.workspace, result.task, input.prompt);
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
        apiBaseUrl,
        fetcher,
        result,
        setTaskStates,
        subscriptions
      });

      void fetchTaskTitle(apiBaseUrl, taskId, fetcher)
        .then((titleResult) => {
          updateTaskTitle(titleResult.id, titleResult.title);
        })
        .catch(() => undefined);
    },
    [apiBaseUrl, fetcher, updateTaskTitle, upsertStartedTask]
  );

  const continueTask = useCallback(
    async (taskId: string, input: ContinueTaskInput) => {
      const result = await continueAgentTask(apiBaseUrl, taskId, input, fetcher);
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
        apiBaseUrl,
        fetcher,
        result,
        setTaskStates,
        subscriptions
      });
    },
    [apiBaseUrl, fetcher]
  );

  const contextValue = useMemo<AgentTasksContextValue>(
    () => ({
      continueTask,
      getTaskState: (taskId) => taskStates[taskId],
      startTask
    }),
    [continueTask, startTask, taskStates]
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
  apiBaseUrl: string;
  fetcher: AgentMessageFetcher;
  result: StartTaskResult;
  setTaskStates: React.Dispatch<
    React.SetStateAction<Record<string, AgentTaskState>>
  >;
  subscriptions: React.RefObject<Map<string, AbortController>>;
}): void {
  const controller = new AbortController();
  const taskId = input.result.task.id;
  input.subscriptions.current.set(input.result.agentId, controller);

  void subscribeToAgentEvents(
    input.apiBaseUrl,
    { agentId: input.result.agentId, signal: controller.signal },
    (event) => {
      input.setTaskStates((current) => ({
        ...current,
        [taskId]: reduceAgentTaskState(
          current[taskId] ?? createInitialAgentTaskState(taskId),
          { event, type: "event_received" }
        )
      }));
    },
    input.fetcher
  )
    .catch((error: unknown) => {
      if (controller.signal.aborted) return;
      input.setTaskStates((current) => ({
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
    })
    .finally(() => {
      input.subscriptions.current.delete(input.result.agentId);
    });
}
