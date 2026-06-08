import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";

import type { WorkspaceSummary } from "../modules/LeftSide/workspace-nav-types";
import type { WorkspaceTaskSummary } from "../modules/LeftSide/workspace-nav-types";

const ACTIVE_AGENT_STORAGE_KEY = "hold-rein.active-agent";
const ACTIVE_WORKSPACE_ID_STORAGE_KEY = "hold-rein.active-workspace-id";

export interface ActiveAgentSelection {
  modelId: string;
  providerId: string;
}

export interface AppWorkspaceState {
  activeAgent: ActiveAgentSelection | null;
  activeTaskId: string;
  activeWorkspaceId: string;
  workspaces: WorkspaceSummary[];
}

export interface AppWorkspaceContextValue {
  state: AppWorkspaceState;
  setActiveAgent: (activeAgent: ActiveAgentSelection | null) => void;
  setActiveTaskId: (taskId: string) => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceSummary[]>>;
  updateTaskTitle: (taskId: string, title: string) => void;
  upsertStartedTask: (
    workspace: StartedWorkspace,
    task: StartedTask,
    temporaryTitle: string
  ) => void;
}

export interface StartedWorkspace {
  id: string;
  name: string;
  path: string;
}

export interface StartedTask extends WorkspaceTaskSummary {
  workspaceId: string;
}

const DEFAULT_APP_WORKSPACE_STATE: AppWorkspaceState = {
  activeAgent: null,
  activeTaskId: "",
  activeWorkspaceId: "",
  workspaces: []
};

const AppWorkspaceContext = createContext<AppWorkspaceContextValue | null>(null);

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isActiveAgentSelection(value: unknown): value is ActiveAgentSelection {
  return (
    typeof value === "object" &&
    value !== null &&
    "modelId" in value &&
    "providerId" in value &&
    typeof value.modelId === "string" &&
    typeof value.providerId === "string"
  );
}

function readStoredActiveAgent(): ActiveAgentSelection | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  const storedAgent = window.localStorage.getItem(ACTIVE_AGENT_STORAGE_KEY);

  if (!storedAgent) {
    return null;
  }

  try {
    const parsedAgent: unknown = JSON.parse(storedAgent);

    return isActiveAgentSelection(parsedAgent) ? parsedAgent : null;
  } catch {
    return null;
  }
}

function readStoredActiveWorkspaceId(): string {
  if (!canUseLocalStorage()) {
    return "";
  }

  return window.localStorage.getItem(ACTIVE_WORKSPACE_ID_STORAGE_KEY) ?? "";
}

function getInitialAppWorkspaceState(): AppWorkspaceState {
  return {
    ...DEFAULT_APP_WORKSPACE_STATE,
    activeAgent: readStoredActiveAgent(),
    activeWorkspaceId: readStoredActiveWorkspaceId()
  };
}

function storeActiveAgent(activeAgent: ActiveAgentSelection | null): void {
  if (!canUseLocalStorage()) {
    return;
  }

  if (!activeAgent) {
    window.localStorage.removeItem(ACTIVE_AGENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTIVE_AGENT_STORAGE_KEY,
    JSON.stringify(activeAgent)
  );
}

function storeActiveWorkspaceId(activeWorkspaceId: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  if (!activeWorkspaceId) {
    window.localStorage.removeItem(ACTIVE_WORKSPACE_ID_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTIVE_WORKSPACE_ID_STORAGE_KEY,
    activeWorkspaceId
  );
}

export function AppWorkspaceProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppWorkspaceState>(
    getInitialAppWorkspaceState
  );

  const setActiveAgent = useCallback(
    (activeAgent: ActiveAgentSelection | null) => {
      storeActiveAgent(activeAgent);
      setState((currentState) => ({
        ...currentState,
        activeAgent
      }));
    },
    []
  );

  const setActiveTaskId = useCallback((activeTaskId: string) => {
    setState((currentState) => ({
      ...currentState,
      activeTaskId
    }));
  }, []);

  const setActiveWorkspaceId = useCallback((activeWorkspaceId: string) => {
    storeActiveWorkspaceId(activeWorkspaceId);
    setState((currentState) => ({
      ...currentState,
      activeWorkspaceId
    }));
  }, []);

  const setWorkspaces = useCallback(
    (workspaces: SetStateAction<WorkspaceSummary[]>) => {
      setState((currentState) => ({
        ...currentState,
        workspaces:
          typeof workspaces === "function"
            ? workspaces(currentState.workspaces)
            : workspaces
      }));
    },
    []
  );

  const updateTaskTitle = useCallback((taskId: string, title: string) => {
    setState((currentState) => ({
      ...currentState,
      workspaces: currentState.workspaces.map((workspace) => ({
        ...workspace,
        tasks: workspace.tasks.map((task) =>
          task.id === taskId ? { ...task, title } : task
        )
      }))
    }));
  }, []);

  const upsertStartedTask = useCallback(
    (
      workspace: StartedWorkspace,
      task: StartedTask,
      temporaryTitle: string
    ) => {
      setState((currentState) => {
        const nextTask: WorkspaceTaskSummary = {
          ...task,
          title: task.title.trim() || temporaryTitle
        };
        const existingWorkspace = currentState.workspaces.find(
          (item) => item.id === workspace.id
        );
        const nextWorkspace: WorkspaceSummary = existingWorkspace
          ? {
              ...existingWorkspace,
              name: workspace.name,
              path: workspace.path,
              tasks: [
                nextTask,
                ...existingWorkspace.tasks.filter(
                  (existingTask) => existingTask.id !== task.id
                )
              ]
            }
          : {
              hasMore: false,
              ...workspace,
              tasks: [nextTask]
            };

        return {
          ...currentState,
          activeTaskId: task.id,
          activeWorkspaceId: workspace.id,
          workspaces: [
            nextWorkspace,
            ...currentState.workspaces.filter(
              (item) => item.id !== workspace.id
            )
          ]
        };
      });
      storeActiveWorkspaceId(workspace.id);
    },
    []
  );

  const contextValue = useMemo<AppWorkspaceContextValue>(
    () => ({
      state,
      setActiveAgent,
      setActiveTaskId,
      setActiveWorkspaceId,
      setWorkspaces,
      updateTaskTitle,
      upsertStartedTask
    }),
    [
      setActiveAgent,
      setActiveTaskId,
      setActiveWorkspaceId,
      setWorkspaces,
      state,
      updateTaskTitle,
      upsertStartedTask
    ]
  );

  return (
    <AppWorkspaceContext.Provider value={contextValue}>
      {children}
    </AppWorkspaceContext.Provider>
  );
}

export function useAppWorkspace() {
  const contextValue = useContext(AppWorkspaceContext);

  if (!contextValue) {
    throw new Error(
      "useAppWorkspace must be used within an AppWorkspaceProvider"
    );
  }

  return contextValue;
}
