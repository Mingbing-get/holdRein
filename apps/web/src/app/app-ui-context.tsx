import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { PropsWithChildren } from "react";

import "./theme.css";

export type ThemeMode = "light" | "dark";

export interface AppUiState {
  activeConversationId: string;
  activeWorkspaceId: string;
  sidebarCollapsed: boolean;
  sidebarResizing: boolean;
  sidebarWidth: number;
  themeMode: ThemeMode;
}

export interface AppUiContextValue {
  state: AppUiState;
  setActiveConversationId: (conversationId: string) => void;
  setActiveWorkspaceId: (workspaceId: string) => void;
  setSidebarResizing: (sidebarResizing: boolean) => void;
  setSidebarWidth: (sidebarWidth: number) => void;
  toggleSidebar: () => void;
  toggleThemeMode: () => void;
}

const DEFAULT_APP_UI_STATE: AppUiState = {
  activeConversationId: "conv-ops-sync",
  activeWorkspaceId: "workspace-engineering",
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

export function AppUiProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppUiState>(DEFAULT_APP_UI_STATE);

  useEffect(() => {
    document.documentElement.dataset.themeMode = state.themeMode;
    document.body.style.background = "var(--app-color-bg-base)";
  }, [state.themeMode]);

  const contextValue = useMemo<AppUiContextValue>(
    () => ({
      state,
      setActiveConversationId: (activeConversationId) => {
        setState((currentState) => ({
          ...currentState,
          activeConversationId
        }));
      },
      setActiveWorkspaceId: (activeWorkspaceId) => {
        setState((currentState) => ({
          ...currentState,
          activeWorkspaceId
        }));
      },
      setSidebarResizing: (sidebarResizing) => {
        setState((currentState) => ({
          ...currentState,
          sidebarResizing
        }));
      },
      setSidebarWidth: (sidebarWidth) => {
        setState((currentState) => ({
          ...currentState,
          sidebarWidth
        }));
      },
      toggleSidebar: () => {
        setState((currentState) => ({
          ...currentState,
          sidebarCollapsed: !currentState.sidebarCollapsed
        }));
      },
      toggleThemeMode: () => {
        setState((currentState) => ({
          ...currentState,
          themeMode: currentState.themeMode === "light" ? "dark" : "light"
        }));
      }
    }),
    [state]
  );

  return (
    <ConfigProvider
      theme={{
        algorithm: THEME_ALGORITHMS[state.themeMode],
        cssVar: {
          key: "hold-rein",
          prefix: "hr"
        },
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
