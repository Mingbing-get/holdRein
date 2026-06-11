// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../../app/app-ui-context";
import { AppWorkspaceProvider } from "../../../app/app-workspace-context";
import type { WorkspaceSummary } from "../workspace-nav-types";
import { WorkspaceSection } from ".";

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

function createMatchMediaMock(): typeof window.matchMedia {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined
  })) as typeof window.matchMedia;
}

const workspaceSummary: WorkspaceSummary = {
  hasMore: true,
  id: "workspace-real",
  name: "Real Workspace",
  path: "/Users/mingbing/apps/real-workspace",
  tasks: [
    {
      id: "task-real-1",
      initialUserMessage: "接入真实接口",
      lastContinuedAt: "2026-06-08T08:00:00.000Z",
      lastModelName: "gpt-4.1",
      lastModelProvider: "openai",
      lastModelProviderSource: "built_in",
      status: "completed",
      title: "接入真实 workspace nav"
    }
  ]
};

describe("WorkspaceSection", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a workspace heading and task rows when expanded", () => {
    renderWorkspaceSection({ collapsed: false });

    const workspaceGroup = screen.getByTestId("workspace-group-workspace-real");
    const task = screen.getByTestId("workspace-task-task-real-1");

    expect(workspaceGroup).toHaveTextContent("Real Workspace");
    expect(screen.getByTestId("workspace-folder-open-icon")).toBeInTheDocument();
    expect(workspaceGroup.parentElement).toHaveStyle({ gap: "2px" });
    expect(task).toHaveTextContent("接入真实 workspace nav");
    expect(task).toHaveStyle({
      borderRadius: "6px",
      fontWeight: "400",
      paddingLeft: "20px"
    });
  });

  it("opens the clicked task and applies active navigation styling", async () => {
    renderWorkspaceSection({ collapsed: false });

    const task = screen.getByTestId("workspace-task-task-real-1");

    fireEvent.click(task);

    await waitFor(() => {
      expect(task.style.background).not.toBe("");
    });
  });

  it("uses a short task label when the section is collapsed", () => {
    renderWorkspaceSection({ collapsed: true });

    expect(screen.queryByTestId("workspace-group-workspace-real")).toBeNull();
    expect(screen.getByTestId("workspace-task-task-real-1")).toHaveTextContent(
      "接W"
    );
  });

  it("uses the initial prompt when the generated title is empty", () => {
    const task = workspaceSummary.tasks[0];

    if (!task) {
      throw new Error("Expected workspace task fixture");
    }

    renderWorkspaceSection({
      collapsed: false,
      workspace: {
        ...workspaceSummary,
        tasks: [{ ...task, title: "" }]
      }
    });

    expect(screen.getByTestId("workspace-task-task-real-1")).toHaveTextContent(
      "接入真实接口"
    );
  });
});

function renderWorkspaceSection({
  collapsed,
  workspace = workspaceSummary
}: {
  collapsed: boolean;
  workspace?: WorkspaceSummary;
}) {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <WorkspaceSection collapsed={collapsed} workspace={workspace} />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}
