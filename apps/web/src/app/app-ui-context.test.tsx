// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedTheme {
  components?: {
    Button?: {
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
  };
}

let capturedTheme: CapturedTheme | null = null;

vi.mock("antd", () => ({
  App: ({ children }: PropsWithChildren) => <>{children}</>,
  ConfigProvider: ({
    children,
    theme
  }: PropsWithChildren<{ theme: CapturedTheme }>) => {
    capturedTheme = theme;

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
