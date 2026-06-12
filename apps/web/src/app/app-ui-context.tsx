import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { PropsWithChildren } from "react";

import "./theme.css";

export type ThemeMode = "light" | "dark";
export type MainContentView = "chat" | "modelProviders";
export type SidebarView = "workspace" | "settings";

export interface AppUiState {
  activeMainView: MainContentView;
  activeSidebarView: SidebarView;
  sidebarCollapsed: boolean;
  sidebarResizing: boolean;
  sidebarWidth: number;
  themeMode: ThemeMode;
}

export interface AppUiContextValue {
  openChatWorkspace: () => void;
  openModelProviders: () => void;
  openSettingsNavigation: () => void;
  openWorkspaceNavigation: () => void;
  state: AppUiState;
  setActiveMainView: (view: MainContentView) => void;
  setActiveSidebarView: (view: SidebarView) => void;
  setSidebarResizing: (sidebarResizing: boolean) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  toggleSidebar: () => void;
  toggleThemeMode: () => void;
}

const DEFAULT_APP_UI_STATE: AppUiState = {
  activeMainView: "chat",
  activeSidebarView: "workspace",
  sidebarCollapsed: false,
  sidebarResizing: false,
  sidebarWidth: 240,
  themeMode: "light"
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
      activeMainView: "chat",
      activeSidebarView: "workspace"
    }));
  }, []);

  const openModelProviders = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeMainView: "modelProviders"
    }));
  }, []);

  const openSettingsNavigation = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeMainView: "modelProviders",
      activeSidebarView: "settings"
    }));
  }, []);

  const openWorkspaceNavigation = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      activeMainView: "chat",
      activeSidebarView: "workspace"
    }));
  }, []);

  const setActiveMainView = useCallback((activeMainView: MainContentView) => {
    setState((currentState) => ({
      ...currentState,
      activeMainView
    }));
  }, []);

  const setActiveSidebarView = useCallback((activeSidebarView: SidebarView) => {
    setState((currentState) => ({
      ...currentState,
      activeSidebarView
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
      openSettingsNavigation,
      openWorkspaceNavigation,
      state,
      setActiveMainView,
      setActiveSidebarView,
      setSidebarResizing,
      setSidebarWidth,
      toggleSidebar,
      toggleThemeMode
    }),
    [
      openChatWorkspace,
      openModelProviders,
      openSettingsNavigation,
      openWorkspaceNavigation,
      setActiveMainView,
      setActiveSidebarView,
      setSidebarResizing,
      setSidebarWidth,
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
