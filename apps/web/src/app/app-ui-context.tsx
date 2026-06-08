import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";

import type { WorkspaceSummary } from "../modules/LeftSide/workspace-nav-types";

import "./theme.css";

export type ThemeMode = "light" | "dark";
export type MainContentView = "chat" | "modelProviders";

export interface AppUiState {
  activeConversationId: string;
  activeMainView: MainContentView;
  activeWorkspaceId: string;
  sidebarCollapsed: boolean;
  sidebarResizing: boolean;
  sidebarWidth: number;
  themeMode: ThemeMode;
  workspaces: WorkspaceSummary[];
}

export interface AppUiContextValue {
  openChatWorkspace: () => void;
  openModelProviders: () => void;
  state: AppUiState;
  setActiveConversationId: (conversationId: string) => void;
  setActiveMainView: (view: MainContentView) => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setSidebarResizing: (sidebarResizing: boolean) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceSummary[]>>;
  toggleSidebar: () => void;
  toggleThemeMode: () => void;
}

const DEFAULT_APP_UI_STATE: AppUiState = {
  activeConversationId: "",
  activeMainView: "chat",
  activeWorkspaceId: "",
  sidebarCollapsed: false,
  sidebarResizing: false,
  sidebarWidth: 240,
  themeMode: "light",
  workspaces: []
};

const AppUiContext = createContext<AppUiContextValue | null>(null);

const THEME_ALGORITHMS = {
  dark: theme.darkAlgorithm,
  light: theme.defaultAlgorithm
} as const;

const ANTD_THEME_TOKEN = {
  borderRadius: 18,
  colorBgBase: "var(--app-color-bg-base)",
  colorBgContainer: "var(--app-color-bg-container)",
  colorBgElevated: "var(--app-color-bg-elevated)",
  colorBorder: "var(--app-color-border)",
  colorBorderSecondary: "var(--app-color-border-secondary)",
  colorFillSecondary: "var(--app-color-fill-secondary)",
  colorFillTertiary: "var(--app-color-fill-tertiary)",
  colorPrimary: "var(--app-color-primary)",
  colorText: "var(--app-color-text)",
  colorTextBase: "var(--app-color-text)",
  colorTextSecondary: "var(--app-color-text-secondary)",
  colorTextTertiary: "var(--app-color-text-tertiary)",
  fontSize: 12,
  fontFamily: "var(--app-font-family)"
} as const;

const ANTD_COMPONENT_TOKENS = {
  Tag: {
    defaultBg: "var(--app-color-fill-secondary)",
    defaultColor: "var(--app-color-text-secondary)"
  }
} as const;

export function AppUiProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppUiState>(DEFAULT_APP_UI_STATE);

  useEffect(() => {
    document.documentElement.dataset.themeMode = state.themeMode;
    document.body.style.background = "var(--app-color-bg-base)";
  }, [state.themeMode]);

  const openChatWorkspace = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeMainView: "chat"
    }));
  }, []);

  const openModelProviders = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeMainView: "modelProviders"
    }));
  }, []);

  const setActiveConversationId = useCallback((activeConversationId: string) => {
    setState((currentState) => ({
      ...currentState,
      activeConversationId
    }));
  }, []);

  const setActiveMainView = useCallback((activeMainView: MainContentView) => {
    setState((currentState) => ({
      ...currentState,
      activeMainView
    }));
  }, []);

  const setActiveWorkspaceId = useCallback((activeWorkspaceId: string) => {
    setState((currentState) => ({
      ...currentState,
      activeWorkspaceId
    }));
  }, []);

  const setSidebarResizing = useCallback((sidebarResizing: boolean) => {
    setState((currentState) => ({
      ...currentState,
      sidebarResizing
    }));
  }, []);

  const setSidebarWidth = useCallback((sidebarWidth: number) => {
    setState((currentState) => ({
      ...currentState,
      sidebarWidth
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

  const toggleSidebar = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      sidebarCollapsed: !currentState.sidebarCollapsed
    }));
  }, []);

  const toggleThemeMode = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      themeMode: currentState.themeMode === "light" ? "dark" : "light"
    }));
  }, []);

  const contextValue = useMemo<AppUiContextValue>(
    () => ({
      openChatWorkspace,
      openModelProviders,
      state,
      setActiveConversationId,
      setActiveMainView,
      setActiveWorkspaceId,
      setSidebarResizing,
      setSidebarWidth,
      setWorkspaces,
      toggleSidebar,
      toggleThemeMode
    }),
    [
      openChatWorkspace,
      openModelProviders,
      setActiveConversationId,
      setActiveMainView,
      setActiveWorkspaceId,
      setSidebarResizing,
      setSidebarWidth,
      setWorkspaces,
      state,
      toggleSidebar,
      toggleThemeMode
    ]
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: THEME_ALGORITHMS[state.themeMode],
        cssVar: {
          key: "hold-rein",
          prefix: "hr"
        },
        components: ANTD_COMPONENT_TOKENS,
        token: ANTD_THEME_TOKEN
      }}
    >
      <AntdApp>
        <AppUiContext.Provider value={contextValue}>
          {children}
        </AppUiContext.Provider>
      </AntdApp>
    </ConfigProvider>
  );
}

export function useAppUi() {
  const contextValue = useContext(AppUiContext);

  if (!contextValue) {
    throw new Error("useAppUi must be used within an AppUiProvider");
  }

  return contextValue;
}
