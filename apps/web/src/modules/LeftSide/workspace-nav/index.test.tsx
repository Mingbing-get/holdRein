// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../../app/app-ui-context";
import type { WorkspaceSummary } from "../workspace-nav-types";
import { WorkspaceNav } from ".";

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

  it("renders the new conversation action and workspace sections", () => {
    renderWorkspaceNav(workspaceSummaries);

    const nav = screen.getByLabelText("Workspace navigation");

    expect(
      within(nav).getByRole("button", { name: "开启新对话" })
    ).toHaveStyle({ borderRadius: "6px" });
    expect(
      within(nav).getByTestId("workspace-group-workspace-real")
    ).toBeInTheDocument();
    expect(within(nav).getByTestId("workspace-task-task-real-1")).toHaveTextContent(
      "接入真实 workspace nav"
    );
  });

  it("shows an empty state when no workspace namespaces are available", () => {
    renderWorkspaceNav([]);

    const nav = screen.getByLabelText("Workspace navigation");

    expect(within(nav).getByText("暂无对话")).toBeInTheDocument();
    expect(
      within(nav).queryByTestId("workspace-group-workspace-real")
    ).not.toBeInTheDocument();
  });
});

function renderWorkspaceNav(workspaces: WorkspaceSummary[]) {
  render(
    <AppUiProvider>
      <WorkspaceNav workspaces={workspaces} />
    </AppUiProvider>
  );
}
