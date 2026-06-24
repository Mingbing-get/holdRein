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
  });

  afterEach(() => {
    cleanup();
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
