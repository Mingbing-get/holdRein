// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedTheme {
  components?: {
    Button?: {
      borderRadius?: number;
      borderRadiusLG?: number;
      borderRadiusSM?: number;
      defaultActiveBg?: string;
      defaultActiveBorderColor?: string;
      defaultActiveColor?: string;
      defaultBg?: string;
      defaultBorderColor?: string;
      defaultColor?: string;
      defaultHoverBg?: string;
      defaultHoverBorderColor?: string;
      defaultHoverColor?: string;
      textTextActiveColor?: string;
      textTextColor?: string;
      textTextHoverColor?: string;
      textHoverBg?: string;
    };
    Input?: {
      activeBg?: string;
      activeBorderColor?: string;
      activeShadow?: string;
      colorBgContainer?: string;
      colorText?: string;
      colorTextPlaceholder?: string;
      hoverBg?: string;
      hoverBorderColor?: string;
      borderRadius?: number;
    };
    InputNumber?: {
      activeBg?: string;
      activeBorderColor?: string;
      activeShadow?: string;
      colorBgContainer?: string;
      colorText?: string;
      colorTextPlaceholder?: string;
      handleBg?: string;
      handleBorderColor?: string;
      hoverBg?: string;
      hoverBorderColor?: string;
      borderRadius?: number;
    };
    Select?: {
      activeBorderColor?: string;
      activeOutlineColor?: string;
      borderRadius?: number;
      borderRadiusLG?: number;
      colorBgElevated?: string;
      colorText?: string;
      colorTextPlaceholder?: string;
      hoverBorderColor?: string;
      optionActiveBg?: string;
      optionSelectedBg?: string;
      optionSelectedColor?: string;
      selectorBg?: string;
      boxShadowSecondary?: string;
    };
    Table?: {
      borderColor?: string;
      colorBgContainer?: string;
      colorFillAlter?: string;
      colorSplit?: string;
      fixedHeaderSortActiveBg?: string;
      headerBg?: string;
      headerColor?: string;
      headerSplitColor?: string;
      rowHoverBg?: string;
    };
    Tabs?: {
      inkBarColor?: string;
      itemActiveColor?: string;
      itemColor?: string;
      itemHoverColor?: string;
      itemSelectedColor?: string;
    };
    Segmented?: {
      itemActiveBg?: string;
      itemColor?: string;
      itemHoverBg?: string;
      itemHoverColor?: string;
      itemSelectedBg?: string;
      itemSelectedColor?: string;
      trackBg?: string;
      trackPadding?: string | number;
    };
  };
}

interface CapturedSegmentedConfig {
  style?: {
    border?: string;
    borderRadius?: number;
  };
}

let capturedTheme: CapturedTheme | null = null;
let capturedSegmentedConfig: CapturedSegmentedConfig | null = null;

const EXPECTED_INPUT_COMPONENT_TOKENS = {
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

function getWebSourcePath(pathFromWebSrc: string): string {
  return join(process.cwd(), "apps", "web", "src", pathFromWebSrc);
}

vi.mock("antd", () => ({
  App: ({ children }: PropsWithChildren) => <>{children}</>,
  ConfigProvider: ({
    children,
    segmented,
    theme
  }: PropsWithChildren<{
    segmented?: CapturedSegmentedConfig;
    theme: CapturedTheme;
  }>) => {
    capturedTheme = theme;
    capturedSegmentedConfig = segmented ?? null;

    return <>{children}</>;
  },
  theme: {
    darkAlgorithm: "dark",
    defaultAlgorithm: "light"
  }
}));

import { AppUiProvider, useAppUi } from "./app-ui-context";

describe("AppUiProvider", () => {
  beforeEach(() => {
    capturedSegmentedConfig = null;
    capturedTheme = null;
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("restores the saved theme mode from local storage", () => {
    window.localStorage.setItem("hold-rein.theme-mode", "dark");

    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(document.documentElement.dataset.themeMode).toBe("dark");
  });

  it("stores the selected theme mode in local storage", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle dark mode" }));

    expect(window.localStorage.getItem("hold-rein.theme-mode")).toBe("dark");
  });

  it("ignores invalid saved theme modes", () => {
    window.localStorage.setItem("hold-rein.theme-mode", "midnight");

    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(document.documentElement.dataset.themeMode).toBe("light");
  });

  it("restores and stores sidebar layout state in local storage", () => {
    window.localStorage.setItem("hold-rein.sidebar-width", "280");
    window.localStorage.setItem("hold-rein.right-sidebar-width", "420");
    window.localStorage.setItem("hold-rein.sidebar-collapsed", "true");
    window.localStorage.setItem("hold-rein.right-sidebar-collapsed", "false");

    render(
      <AppUiProvider>
        <SidebarLayoutControls />
      </AppUiProvider>
    );

    expect(screen.getByTestId("sidebar-width")).toHaveTextContent("280");
    expect(screen.getByTestId("right-sidebar-width")).toHaveTextContent("420");
    expect(screen.getByTestId("sidebar-collapsed")).toHaveTextContent("true");
    expect(screen.getByTestId("right-sidebar-collapsed")).toHaveTextContent(
      "false"
    );

    fireEvent.click(screen.getByRole("button", { name: "Set sidebar width" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Set right sidebar width" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Toggle right sidebar" })
    );

    expect(window.localStorage.getItem("hold-rein.sidebar-width")).toBe("300");
    expect(window.localStorage.getItem("hold-rein.right-sidebar-width")).toBe(
      "460"
    );
    expect(window.localStorage.getItem("hold-rein.sidebar-collapsed")).toBe(
      "false"
    );
    expect(
      window.localStorage.getItem("hold-rein.right-sidebar-collapsed")
    ).toBe("true");
  });

  it("keeps default button hover text readable in dark mode", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Toggle dark mode" }));

    expect(capturedTheme?.components?.Button).toMatchObject({
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
      defaultHoverColor: "var(--app-color-text)"
    });
  });

  it("configures segmented controls globally with app theme variables", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.Segmented).toMatchObject({
      itemActiveBg: "var(--app-color-fill-tertiary)",
      itemColor: "var(--app-color-text-secondary)",
      itemHoverBg: "transparent",
      itemHoverColor: "var(--app-color-text)",
      itemSelectedBg: "var(--app-color-bg-elevated)",
      itemSelectedColor: "var(--app-color-text)",
      trackBg: "var(--app-color-fill-secondary)",
      trackPadding: 1
    });
    expect(capturedSegmentedConfig?.style).toMatchObject({
      border: "1px solid var(--app-color-border-secondary)",
      borderRadius: 4
    });
  });

  it("configures inputs globally with app theme variables", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.Input).toMatchObject(
      EXPECTED_INPUT_COMPONENT_TOKENS
    );
  });

  it("configures input numbers globally with app theme variables", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.InputNumber).toMatchObject({
      ...EXPECTED_INPUT_COMPONENT_TOKENS,
      handleBg: "var(--app-color-bg-container)",
      handleBorderColor: "var(--app-color-border-secondary)"
    });
  });

  it("configures selects globally to match input triggers and sender popup styles", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.Select).toMatchObject({
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
    });
  });

  it("configures tables globally with app theme variables", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.Table).toMatchObject({
      borderColor: "var(--app-color-border-secondary)",
      colorBgContainer: "var(--app-color-bg-container)",
      colorFillAlter: "var(--app-color-scheduled-table-header-bg)",
      colorSplit: "var(--app-color-border-secondary)",
      fixedHeaderSortActiveBg: "var(--app-color-scheduled-table-header-bg)",
      headerBg: "var(--app-color-scheduled-table-header-bg)",
      headerColor: "var(--app-color-text)",
      headerSplitColor: "var(--app-color-border-secondary)",
      rowHoverBg: "var(--app-color-scheduled-table-row-hover-bg)"
    });
  });

  it("configures tabs globally with app theme variables", () => {
    render(
      <AppUiProvider>
        <ThemeModeToggle />
      </AppUiProvider>
    );

    expect(capturedTheme?.components?.Tabs).toMatchObject({
      inkBarColor: "var(--app-color-primary)",
      itemActiveColor: "var(--app-color-primary)",
      itemColor: "var(--app-color-text-secondary)",
      itemHoverColor: "var(--app-color-primary-hover)",
      itemSelectedColor: "var(--app-color-primary)"
    });
  });

  it("adds sender-style borders to select dropdown popups", () => {
    const themeCssSource = readFileSync(getWebSourcePath("app/theme.css"), "utf8");

    expect(themeCssSource).toContain(".ant-select-dropdown");
    expect(themeCssSource).toContain(
      "border: 1px solid var(--app-color-border-secondary);"
    );
  });
});

function ThemeModeToggle() {
  const { toggleThemeMode } = useAppUi();

  return (
    <button onClick={toggleThemeMode} type="button">
      Toggle dark mode
    </button>
  );
}

function SidebarLayoutControls() {
  const {
    setRightSidebarWidth,
    setSidebarWidth,
    state,
    toggleRightSidebar,
    toggleSidebar
  } = useAppUi();

  return (
    <>
      <span data-testid="sidebar-width">{state.sidebarWidth}</span>
      <span data-testid="right-sidebar-width">{state.rightSidebarWidth}</span>
      <span data-testid="sidebar-collapsed">
        {String(state.sidebarCollapsed)}
      </span>
      <span data-testid="right-sidebar-collapsed">
        {String(state.rightSidebarCollapsed)}
      </span>
      <button onClick={() => setSidebarWidth(300)} type="button">
        Set sidebar width
      </button>
      <button onClick={() => setRightSidebarWidth(460)} type="button">
        Set right sidebar width
      </button>
      <button onClick={toggleSidebar} type="button">
        Toggle sidebar
      </button>
      <button onClick={toggleRightSidebar} type="button">
        Toggle right sidebar
      </button>
    </>
  );
}
