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

    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();
    expect(within(topBar).queryByText("Engineering Hub")).not.toBeInTheDocument();
    expect(
      within(topBar).getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Model configuration" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open settings" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Toggle theme" })
    ).toBeInTheDocument();
    expect(topBar).toHaveStyle({ padding: "8px 16px" });
    expect(document.body).toHaveStyle({ background: "#fff" });
  });

  it("toggles the app theme from light to dark", () => {
    render(<App />);

    expect(document.documentElement.dataset.themeMode).toBe("light");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle theme" }));

    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(screen.getByRole("switch", { name: "Toggle theme" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("shows tooltips for model configuration and settings actions", async () => {
    render(<App />);

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "Model configuration" })
    );
    expect(await screen.findByText("Model configuration")).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Open settings" }));
    expect(await screen.findByText("Open settings")).toBeInTheDocument();
  });

  it("collapses the workspace sidebar", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    expect(within(sidebar).getByText("Engineering Hub")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();
    expect(sidebar).not.toBeVisible();
    expect(within(sidebar).queryByText("Engineering Hub")).not.toBeInTheDocument();
  });

  it("renders workspace groups and conversations with aligned navigation styling", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const engineeringGroup = within(sidebar).getByTestId(
      "workspace-group-workspace-engineering"
    );
    const activeConversation = within(sidebar).getByTestId(
      "workspace-conversation-conv-ops-sync"
    );
    const inactiveConversation = within(sidebar).getByTestId(
      "workspace-conversation-conv-release-audit"
    );

    expect(
      within(engineeringGroup).getByTestId("workspace-folder-open-icon")
    ).toBeInTheDocument();
    expect(engineeringGroup.parentElement).toHaveStyle({ gap: "2px" });
    expect(activeConversation).toHaveStyle({
      borderRadius: "6px",
      fontWeight: "400",
      paddingLeft: "20px"
    });
    expect(activeConversation.style.background).not.toBe("");

    fireEvent.mouseEnter(inactiveConversation);

    expect(inactiveConversation).toHaveStyle({
      borderRadius: "6px",
      paddingLeft: "20px"
    });
    expect(inactiveConversation.style.background).not.toBe("");
  });

  it("resizes the workspace sidebar from its right border within bounds", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const workspaceLayout = screen.getByTestId("workspace-main-layout");
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar"
    });

    expect(sidebar).toHaveStyle({ width: "240px" });
    expect(resizeHandle).toHaveStyle({ cursor: "col-resize" });

    fireEvent.mouseEnter(resizeHandle);

    expect(sidebar).toHaveStyle({ borderRightColor: "#1f6feb" });

    fireEvent.mouseDown(resizeHandle, { clientX: 240 });

    expect(sidebar).toHaveStyle({ transition: "transform 0.2s ease" });
    expect(workspaceLayout).toHaveStyle({ transition: "none" });

    fireEvent.mouseMove(document, { clientX: 800 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "680px" });

    fireEvent.mouseDown(resizeHandle, { clientX: 680 });
    fireEvent.mouseMove(document, { clientX: 0 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "120px" });
  });
});
