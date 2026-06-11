// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../../app/app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../../app/app-workspace-context";
import type { WorkspaceSummary } from "../workspace-nav-types";
import { WorkspaceNav } from ".";

vi.mock("../../agent-messages", () => ({
  useAgentTasks: () => ({
    hasUnreadCompletion: () => false
  })
}));

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

const workspaceSummaries: WorkspaceSummary[] = [
  {
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
  }
];

describe("WorkspaceNav", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the new task action and workspace sections", () => {
    renderWorkspaceNav(workspaceSummaries);

    const nav = screen.getByLabelText("Workspace navigation");
    const scrollRegion = within(nav).getByLabelText(
      "Workspace and task navigation"
    );
    const newTaskButton = within(nav).getByRole("button", {
      name: "开启新任务"
    });

    expect(newTaskButton).toHaveStyle({ borderRadius: "6px", flexShrink: "0" });
    expect(scrollRegion).toHaveStyle({
      flex: "1",
      minHeight: "0",
      overflowY: "auto"
    });
    expect(scrollRegion).not.toContainElement(newTaskButton);
    expect(
      within(scrollRegion).getByTestId("workspace-group-workspace-real")
    ).toBeInTheDocument();
    expect(
      within(scrollRegion).getByTestId("workspace-task-task-real-1")
    ).toHaveTextContent("接入真实 workspace nav");
  });

  it("shows an empty state when no workspace namespaces are available", () => {
    renderWorkspaceNav([]);

    const nav = screen.getByLabelText("Workspace navigation");

    expect(within(nav).getByText("暂无任务")).toBeInTheDocument();
    expect(
      within(nav).getByRole("button", { name: "开启新任务" })
    ).toBeDisabled();
    expect(
      within(nav).queryByTestId("workspace-group-workspace-real")
    ).not.toBeInTheDocument();
  });

  it("starts a blank conversation in the active workspace", () => {
    renderWorkspaceNav(workspaceSummaries, {
      activeTaskId: "task-real-1",
      activeWorkspaceId: "workspace-real"
    });

    fireEvent.click(screen.getByRole("button", { name: "开启新任务" }));

    expect(screen.getByTestId("active-workspace-id")).toHaveTextContent(
      "workspace-real"
    );
    expect(screen.getByTestId("active-task-id")).toBeEmptyDOMElement();
  });
});

function renderWorkspaceNav(
  workspaces: WorkspaceSummary[],
  activeSelection: {
    activeTaskId?: string;
    activeWorkspaceId?: string;
  } = {}
) {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <WorkspaceNavTestState
          {...activeSelection}
          workspaces={workspaces}
        />
        <WorkspaceNav apiBaseUrl="http://localhost:4000" />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function WorkspaceNavTestState({
  activeTaskId,
  activeWorkspaceId,
  workspaces
}: {
  activeTaskId?: string;
  activeWorkspaceId?: string;
  workspaces: WorkspaceSummary[];
}) {
  const {
    state,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces(workspaces);
    setActiveTaskId(activeTaskId ?? "");
    setActiveWorkspaceId(activeWorkspaceId ?? "");
  }, [
    activeTaskId,
    activeWorkspaceId,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces,
    workspaces
  ]);

  return (
    <>
      <span data-testid="active-workspace-id">{state.activeWorkspaceId}</span>
      <span data-testid="active-task-id">{state.activeTaskId}</span>
    </>
  );
}
