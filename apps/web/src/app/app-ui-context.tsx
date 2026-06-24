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
import type { WebPlugin } from '@hold-rein/plugin-web'

import "./theme.css";

const THEME_MODE_STORAGE_KEY = "hold-rein.theme-mode";

const DEFAULT_APP_UI_STATE: WebPlugin.AppUiState = {
  activeMainView: "chat",
  activeSidebarView: "workspace",
  rightSidebarCollapsed: true,
  rightSidebarResizing: false,
  rightSidebarWidth: 320,
  sidebarCollapsed: false,
  sidebarResizing: false,
  sidebarWidth: 240,
  themeMode: "light"
};

const AppUiContext = createContext<WebPlugin.AppUiContextValue | null>(null);

const THEME_ALGORITHMS = {
  dark: theme.darkAlgorithm,
  light: theme.defaultAlgorithm
} as const;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isThemeMode(value: unknown): value is WebPlugin.AppUiState["themeMode"] {
  return value === "dark" || value === "light";
}

function readStoredThemeMode(): WebPlugin.AppUiState["themeMode"] {
  if (!canUseLocalStorage()) {
    return DEFAULT_APP_UI_STATE.themeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  return isThemeMode(storedThemeMode)
    ? storedThemeMode
    : DEFAULT_APP_UI_STATE.themeMode;
}

function getInitialAppUiState(): WebPlugin.AppUiState {
  return {
    ...DEFAULT_APP_UI_STATE,
    themeMode: readStoredThemeMode()
  };
}

function storeThemeMode(themeMode: WebPlugin.AppUiState["themeMode"]): void {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, themeMode);
}

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
  Button: {
    defaultActiveBg: "var(--app-color-fill-secondary)",
    defaultActiveBorderColor: "var(--app-color-border-secondary)",
    defaultActiveColor: "var(--app-color-text)",
    defaultBg: "transparent",
    defaultBorderColor: "var(--app-color-border-secondary)",
    defaultColor: "var(--app-color-text)",
    defaultHoverBg: "var(--app-color-fill-tertiary)",
    defaultHoverBorderColor: "var(--app-color-border-secondary)",
    defaultHoverColor: "var(--app-color-text)",
    textHoverBg: "var(--app-color-fill-tertiary)",
    textTextActiveColor: "var(--app-color-text)",
    textTextColor: "var(--app-color-text)",
    textTextHoverColor: "var(--app-color-text)"
  },
  Tag: {
    defaultBg: "var(--app-color-fill-secondary)",
    defaultColor: "var(--app-color-text-secondary)"
  }
} as const;

export function AppUiProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<WebPlugin.AppUiState>(getInitialAppUiState);

  useEffect(() => {
    document.documentElement.dataset.themeMode = state.themeMode;
    document.body.style.background = "var(--app-color-bg-base)";
  }, [state.themeMode]);

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

  const setActiveMainView = useCallback((activeMainView: WebPlugin.MainContentView) => {
    setState((currentState) => ({
      ...currentState,
      activeMainView
    }));
  }, []);

  const setActiveSidebarView = useCallback((activeSidebarView: WebPlugin.SidebarView) => {
    setState((currentState) => ({
      ...currentState,
      activeSidebarView
    }));
  }, []);

  const setRightSidebarResizing = useCallback(
    (rightSidebarResizing: boolean) => {
      setState((currentState) => ({
        ...currentState,
        rightSidebarResizing
      }));
    },
    []
  );

  const setRightSidebarWidth = useCallback((rightSidebarWidth: number) => {
    setState((currentState) => ({
      ...currentState,
      rightSidebarWidth
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

  const toggleRightSidebar = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      rightSidebarCollapsed: !currentState.rightSidebarCollapsed
    }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((currentState) => ({
      ...currentState,
      sidebarCollapsed: !currentState.sidebarCollapsed
    }));
  }, []);

  const toggleThemeMode = useCallback(() => {
    setState((currentState) => {
      const themeMode = currentState.themeMode === "light" ? "dark" : "light";
      storeThemeMode(themeMode);

      return {
        ...currentState,
        themeMode
      };
    });
  }, []);

  const contextValue = useMemo<WebPlugin.AppUiContextValue>(
    () => ({
      openSettingsNavigation,
      openWorkspaceNavigation,
      state,
      setActiveMainView,
      setActiveSidebarView,
      setRightSidebarResizing,
      setRightSidebarWidth,
      setSidebarResizing,
      setSidebarWidth,
      toggleRightSidebar,
      toggleSidebar,
      toggleThemeMode
    }),
    [
      openSettingsNavigation,
      openWorkspaceNavigation,
      setActiveMainView,
      setActiveSidebarView,
      setRightSidebarResizing,
      setRightSidebarWidth,
      setSidebarResizing,
      setSidebarWidth,
      state,
      toggleRightSidebar,
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
