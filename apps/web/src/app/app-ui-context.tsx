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

const APP_UI_STORAGE_KEYS = {
  rightSidebarCollapsed: "hold-rein.right-sidebar-collapsed",
  rightSidebarWidth: "hold-rein.right-sidebar-width",
  sidebarCollapsed: "hold-rein.sidebar-collapsed",
  sidebarWidth: "hold-rein.sidebar-width",
  themeMode: "hold-rein.theme-mode"
} as const;

const DEFAULT_APP_UI_STATE: WebPlugin.AppUiState = {
  activeMainView: "chat",
  activeSidebarView: "workspace",
  rightActiveView: "",
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

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseStoredBoolean(value: string | null): boolean | null {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
}

function parseStoredNumber(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseStoredThemeMode(
  value: string | null
): WebPlugin.AppUiState["themeMode"] | null {
  return isThemeMode(value) ? value : null;
}

function readStoredAppUiValue<Value>(
  storageKey: string,
  defaultValue: Value,
  parseValue: (value: string | null) => Value | null
): Value {
  if (!canUseLocalStorage()) {
    return defaultValue;
  }

  const storedValue = parseValue(window.localStorage.getItem(storageKey));

  return storedValue ?? defaultValue;
}

function getInitialAppUiState(): WebPlugin.AppUiState {
  return {
    ...DEFAULT_APP_UI_STATE,
    rightSidebarCollapsed: readStoredAppUiValue(
      APP_UI_STORAGE_KEYS.rightSidebarCollapsed,
      DEFAULT_APP_UI_STATE.rightSidebarCollapsed,
      parseStoredBoolean
    ),
    rightSidebarWidth: readStoredAppUiValue(
      APP_UI_STORAGE_KEYS.rightSidebarWidth,
      DEFAULT_APP_UI_STATE.rightSidebarWidth,
      parseStoredNumber
    ),
    sidebarCollapsed: readStoredAppUiValue(
      APP_UI_STORAGE_KEYS.sidebarCollapsed,
      DEFAULT_APP_UI_STATE.sidebarCollapsed,
      parseStoredBoolean
    ),
    sidebarWidth: readStoredAppUiValue(
      APP_UI_STORAGE_KEYS.sidebarWidth,
      DEFAULT_APP_UI_STATE.sidebarWidth,
      parseStoredNumber
    ),
    themeMode: readStoredAppUiValue(
      APP_UI_STORAGE_KEYS.themeMode,
      DEFAULT_APP_UI_STATE.themeMode,
      parseStoredThemeMode
    )
  };
}

function storeAppUiValue<Value>(
  storageKey: string,
  value: Value,
  isValidValue: (value: unknown) => value is Value
): void {
  if (!canUseLocalStorage()) {
    return;
  }

  if (isValidValue(value)) {
    window.localStorage.setItem(storageKey, String(value));
  }
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

const ANTD_INPUT_COMPONENT_TOKENS = {
  activeBg: "var(--app-color-bg-container)",
  activeBorderColor: "var(--app-color-primary)",
  activeShadow:
    "0 0 0 2px color-mix(in srgb, var(--app-color-primary) 20%, transparent)",
  borderRadius: 4,
  colorBgContainer: "var(--app-color-bg-container)",
  colorText: "var(--app-color-text)",
  colorTextPlaceholder: "var(--app-color-input-placeholder)",
  hoverBg: "var(--app-color-bg-container)",
  hoverBorderColor: "var(--app-color-primary-hover)"
} as const;

const ANTD_SELECT_COMPONENT_TOKENS = {
  activeBorderColor: "var(--app-color-primary)",
  activeOutlineColor:
    "color-mix(in srgb, var(--app-color-primary) 20%, transparent)",
  borderRadius: 4,
  borderRadiusLG: 16,
  boxShadowSecondary:
    "0 18px 36px color-mix(in srgb, var(--app-color-shadow) 32%, transparent)",
  colorBgElevated: "var(--app-color-bg-elevated)",
  colorText: "var(--app-color-text)",
  colorTextPlaceholder: "var(--app-color-input-placeholder)",
  hoverBorderColor: "var(--app-color-primary-hover)",
  optionActiveBg: "var(--app-color-fill-secondary)",
  optionSelectedBg:
    "color-mix(in srgb, var(--app-color-primary) 16%, var(--app-color-bg-elevated))",
  optionSelectedColor: "var(--app-color-text)",
  selectorBg: "var(--app-color-bg-container)"
} as const;

const ANTD_COMPONENT_TOKENS = {
  Button: {
    borderRadius: 4,
    borderRadiusLG: 4,
    borderRadiusSM: 4,
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
  Input: ANTD_INPUT_COMPONENT_TOKENS,
  InputNumber: {
    ...ANTD_INPUT_COMPONENT_TOKENS,
    handleBg: "var(--app-color-bg-container)",
    handleBorderColor: "var(--app-color-border-secondary)"
  },
  Segmented: {
    borderRadius: 4,
    borderRadiusSM: 4,
    boxShadowTertiary:
      "0 1px 4px color-mix(in srgb, var(--app-color-shadow) 55%, transparent)",
    itemActiveBg: "var(--app-color-fill-tertiary)",
    itemColor: "var(--app-color-text-secondary)",
    itemHoverBg: "transparent",
    itemHoverColor: "var(--app-color-text)",
    itemSelectedBg: "var(--app-color-bg-elevated)",
    itemSelectedColor: "var(--app-color-text)",
    trackBg: "var(--app-color-fill-secondary)",
    trackPadding: 1
  },
  Select: ANTD_SELECT_COMPONENT_TOKENS,
  Table: {
    borderColor: "var(--app-color-border-secondary)",
    colorBgContainer: "var(--app-color-bg-container)",
    colorFillAlter: "var(--app-color-scheduled-table-header-bg)",
    colorSplit: "var(--app-color-border-secondary)",
    fixedHeaderSortActiveBg: "var(--app-color-scheduled-table-header-bg)",
    headerBg: "var(--app-color-scheduled-table-header-bg)",
    headerColor: "var(--app-color-text)",
    headerSplitColor: "var(--app-color-border-secondary)",
    rowHoverBg: "var(--app-color-scheduled-table-row-hover-bg)"
  },
  Tag: {
    defaultBg: "var(--app-color-fill-secondary)",
    defaultColor: "var(--app-color-text-secondary)"
  }
} as const;

const ANTD_SEGMENTED_CONFIG = {
  style: {
    border: "1px solid var(--app-color-border-secondary)",
    borderRadius: 4
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

  const setRightActiveView = useCallback((rightActiveView: string) => {
    setState((currentState) => ({
      ...currentState,
      rightActiveView
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
    storeAppUiValue(
      APP_UI_STORAGE_KEYS.rightSidebarWidth,
      rightSidebarWidth,
      isNumber
    );
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
    storeAppUiValue(APP_UI_STORAGE_KEYS.sidebarWidth, sidebarWidth, isNumber);
    setState((currentState) => ({
      ...currentState,
      sidebarWidth
    }));
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setState((currentState) => {
      const rightSidebarCollapsed = !currentState.rightSidebarCollapsed;
      storeAppUiValue(
        APP_UI_STORAGE_KEYS.rightSidebarCollapsed,
        rightSidebarCollapsed,
        isBoolean
      );

      return {
        ...currentState,
        rightSidebarCollapsed
      };
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((currentState) => {
      const sidebarCollapsed = !currentState.sidebarCollapsed;
      storeAppUiValue(
        APP_UI_STORAGE_KEYS.sidebarCollapsed,
        sidebarCollapsed,
        isBoolean
      );

      return {
        ...currentState,
        sidebarCollapsed
      };
    });
  }, []);

  const toggleThemeMode = useCallback(() => {
    setState((currentState) => {
      const themeMode = currentState.themeMode === "light" ? "dark" : "light";
      storeAppUiValue(APP_UI_STORAGE_KEYS.themeMode, themeMode, isThemeMode);

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
      setRightActiveView,
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
      setRightActiveView,
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
      segmented={ANTD_SEGMENTED_CONFIG}
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
