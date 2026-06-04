import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import type { PropsWithChildren } from "react";

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

export function AppUiProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AppUiState>(DEFAULT_APP_UI_STATE);

  useEffect(() => {
    document.documentElement.dataset.themeMode = state.themeMode;
    document.body.style.background =
      state.themeMode === "dark" ? "#000" : "#fff";
    document.body.style.margin = "0";
    document.body.style.fontSize = "12px";
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

  const isDarkMode = state.themeMode === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 18,
          colorBgBase: isDarkMode ? "#0e1624" : "#f4f6fb",
          colorBgContainer: isDarkMode ? "#111c2b" : "#ffffff",
          colorPrimary: isDarkMode ? "#7cc7ff" : "#1f6feb",
          colorTextBase: isDarkMode ? "#eff5ff" : "#152033",
          fontSize: 12,
          fontFamily:
            '"IBM Plex Sans", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif'
        }
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
