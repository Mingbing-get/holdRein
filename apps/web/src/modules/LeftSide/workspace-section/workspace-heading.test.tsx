// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { WorkspaceHeading } from "./workspace-heading";

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

describe("WorkspaceHeading", () => {
  afterEach(cleanup);

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("shows new conversation, settings and delete actions on hover", async () => {
    render(
      <WorkspaceHeading
        collapsed={false}
        onDelete={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenScheduledTasks={vi.fn()}
        onStartNewConversation={vi.fn()}
        onToggleCollapsed={vi.fn()}
        workspace={{
          hasMore: false,
          id: "workspace-real",
          name: "Real Workspace",
          path: "/workspace",
          tasks: []
        }}
      />
    );

    expect(
      screen.queryByRole("button", { name: "工作空间操作 Real Workspace" })
    ).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId("workspace-heading-workspace-real"));
    fireEvent.click(
      screen.getByRole("button", { name: "工作空间操作 Real Workspace" })
    );

    expect(await screen.findByText("新对话")).toBeInTheDocument();
    expect(screen.getByText("定时任务")).toBeInTheDocument();
    expect(screen.getByText("设置")).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-new-conversation-icon")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-scheduled-tasks-icon")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-settings-icon")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-delete-icon")).toBeInTheDocument();
  });
});
