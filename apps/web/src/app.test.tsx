// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

vi.mock("./config/env", () => ({
  getAppEnv: () => ({
    apiBaseUrl: "http://localhost:4000"
  })
}));

import App from "./App";

describe("App", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("renders the workspace shell with top bar actions", () => {
    render(<App />);
    const sidebar = screen.getByLabelText("Workspace sidebar");
    const topBar = screen.getByTestId("workspace-top-bar");
    const chatWorkspace = screen.getByTestId("chat-workspace");

    expect(screen.getByText("Hold Rein")).toBeInTheDocument();
    expect(screen.getByText("Folder Selector")).toBeInTheDocument();
    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open settings" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle theme" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage models" })
    ).toBeInTheDocument();
    expect(screen.getByText("Conversation Workspace")).toBeInTheDocument();
    expect(screen.getByText(/http:\/\/localhost:4000/)).toBeInTheDocument();
    expect(topBar).toHaveStyle({ padding: "8px 16px" });
    expect(chatWorkspace).toHaveStyle({ fontSize: "12px" });
    expect(document.body).toHaveStyle({ background: "#f4f6fb" });
  });

  it("toggles the app theme from light to dark", () => {
    render(<App />);

    expect(document.documentElement.dataset.themeMode).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
  });

  it("collapses the workspace sidebar", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    expect(within(sidebar).queryByText("Engineering Hub")).not.toBeInTheDocument();
  });
});
