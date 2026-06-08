// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../app/app-ui-context";
import { WorkspaceSidebar } from "./workspace-sidebar";
import type { WorkspaceSummary } from "./workspace-nav-types";

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

describe("WorkspaceSidebar", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders workspace groups and tasks with aligned navigation styling", async () => {
    renderWorkspaceSidebar(workspaceSummaries);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const newConversationButton = within(sidebar).getByRole("button", {
      name: "开启新对话"
    });
    const workspaceGroup = await within(sidebar).findByTestId(
      "workspace-group-workspace-real"
    );
    const task = within(sidebar).getByTestId("workspace-task-task-real-1");

    expect(
      within(workspaceGroup).getByTestId("workspace-folder-open-icon")
    ).toBeInTheDocument();
    expect(newConversationButton).toHaveStyle({
      borderRadius: "6px"
    });
    expect(workspaceGroup.parentElement).toHaveStyle({ gap: "2px" });
    expect(task).toHaveStyle({
      borderRadius: "6px",
      fontWeight: "400",
      paddingLeft: "20px"
    });

    fireEvent.click(task);

    await waitFor(() => {
      expect(task.style.background).not.toBe("");
    });

    fireEvent.mouseEnter(task);

    expect(task).toHaveStyle({
      borderRadius: "6px",
      paddingLeft: "20px"
    });
    expect(task.style.background).not.toBe("");
  });

  it("shows an empty state when no workspace namespaces are available", () => {
    renderWorkspaceSidebar([]);

    const sidebar = screen.getByLabelText("Workspace sidebar");

    expect(within(sidebar).getByText("暂无对话")).toBeInTheDocument();
    expect(
      within(sidebar).queryByTestId("workspace-group-workspace-real")
    ).not.toBeInTheDocument();
  });
});

function renderWorkspaceSidebar(workspaces: WorkspaceSummary[]) {
  render(
    <AppUiProvider>
      <WorkspaceSidebar workspaces={workspaces} />
    </AppUiProvider>
  );
}
