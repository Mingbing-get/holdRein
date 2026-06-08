import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";

import type { WorkspaceSummary } from "../modules/LeftSide/workspace-nav-types";

export interface AppWorkspaceState {
  activeTaskId: string;
  activeWorkspaceId: string;
  workspaces: WorkspaceSummary[];
}

export interface AppWorkspaceContextValue {
  state: AppWorkspaceState;
  setActiveTaskId: (taskId: string) => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceSummary[]>>;
}

const DEFAULT_APP_WORKSPACE_STATE: AppWorkspaceState = {
  activeTaskId: "",
  activeWorkspaceId: "",
  workspaces: []
};

const AppWorkspaceContext = createContext<AppWorkspaceContextValue | null>(null);

export function AppWorkspaceProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppWorkspaceState>(
    DEFAULT_APP_WORKSPACE_STATE
  );

  const setActiveTaskId = useCallback((activeTaskId: string) => {
    setState((currentState) => ({
      ...currentState,
      activeTaskId
    }));
  }, []);

  const setActiveWorkspaceId = useCallback((activeWorkspaceId: string) => {
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

  const contextValue = useMemo<AppWorkspaceContextValue>(
    () => ({
      state,
      setActiveTaskId,
      setActiveWorkspaceId,
      setWorkspaces
    }),
    [setActiveTaskId, setActiveWorkspaceId, setWorkspaces, state]
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
