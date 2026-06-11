// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppUiProvider } from "../../../app/app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../../app/app-workspace-context";
import type { WorkspaceSummary } from "../workspace-nav-types";
import { WorkspaceSection } from ".";

const deleteWorkspaceMock = vi.fn();
const deleteTaskMock = vi.fn();
const renameTaskMock = vi.fn();

vi.mock("../../agent-messages", () => ({
  useAgentTasks: () => ({
    hasUnreadCompletion: () => false
  })
}));

vi.mock("../workspace-nav-api", () => ({
  deleteTask: (...args: unknown[]) => deleteTaskMock(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspaceMock(...args),
  renameTask: (...args: unknown[]) => renameTaskMock(...args)
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
    deleteTaskMock.mockReset();
    deleteWorkspaceMock.mockReset();
    renameTaskMock.mockReset();
  });

  it("renders a workspace heading and task rows when expanded", () => {
    renderWorkspaceSection({ collapsed: false });

    const workspaceGroup = screen.getByTestId("workspace-group-workspace-real");
    const task = screen.getByTestId("workspace-task-task-real-1");

    expect(workspaceGroup).toHaveTextContent("Real Workspace");
    expect(screen.getByTestId("workspace-folder-open-icon")).toBeInTheDocument();
    expect(workspaceGroup.parentElement?.parentElement).toHaveStyle({
      gap: "2px"
    });
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

  it("toggles the workspace task list from the workspace name", () => {
    renderWorkspaceSection({ collapsed: false });

    const workspaceToggle = screen.getByRole("button", {
      name: "折叠工作空间 Real Workspace"
    });

    fireEvent.click(workspaceToggle);

    expect(screen.queryByTestId("workspace-task-task-real-1")).toBeNull();
    expect(screen.getByTestId("workspace-folder-icon")).toBeInTheDocument();
    expect(workspaceToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(workspaceToggle);

    expect(screen.getByTestId("workspace-task-task-real-1")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-folder-open-icon")).toBeInTheDocument();
    expect(workspaceToggle).toHaveAttribute("aria-expanded", "true");
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

  it("shows workspace actions on heading hover with plus and delete icons", async () => {
    renderWorkspaceSection({ collapsed: false });

    expect(
      screen.queryByRole("button", { name: "工作空间操作 Real Workspace" })
    ).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId("workspace-heading-workspace-real"));
    fireEvent.click(
      screen.getByRole("button", { name: "工作空间操作 Real Workspace" })
    );

    expect(await screen.findByText("新对话")).toBeInTheDocument();
    expect(screen.getByText("删除")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-new-conversation-icon")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-delete-icon")).toBeInTheDocument();
  });

  it("starts a new conversation in the selected workspace", async () => {
    renderWorkspaceSection({ collapsed: false });

    fireEvent.mouseEnter(screen.getByTestId("workspace-heading-workspace-real"));
    fireEvent.click(
      screen.getByRole("button", { name: "工作空间操作 Real Workspace" })
    );
    fireEvent.click(await screen.findByText("新对话"));

    expect(screen.getByTestId("selected-workspace")).toHaveTextContent(
      "workspace-real"
    );
    expect(screen.getByTestId("selected-task")).toBeEmptyDOMElement();
  });

  it("confirms before deleting a workspace", async () => {
    deleteWorkspaceMock.mockResolvedValue({ workspaceId: "workspace-real" });
    renderWorkspaceSection({ collapsed: false });

    openDeleteAction();

    expect(deleteWorkspaceMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(deleteWorkspaceMock).toHaveBeenCalledWith(
        "http://localhost:4000",
        "workspace-real"
      );
    });
    expect(screen.getByTestId("workspace-ids")).toBeEmptyDOMElement();
  });

  it("keeps a workspace after delete failure", async () => {
    deleteWorkspaceMock.mockRejectedValue(
      new Error("Workspace has running tasks")
    );
    renderWorkspaceSection({ collapsed: false });

    openDeleteAction();
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));

    expect(
      await screen.findByText("Workspace has running tasks")
    ).toBeInTheDocument();
    expect(screen.getByTestId("workspace-ids")).toHaveTextContent(
      "workspace-real"
    );
  });

  it("shows task actions on task hover with edit and delete icons", async () => {
    renderWorkspaceSection({ collapsed: false });

    expect(
      screen.queryByRole("button", { name: "任务操作 接入真实 workspace nav" })
    ).toBeNull();

    fireEvent.mouseEnter(screen.getByTestId("workspace-task-task-real-1"));
    fireEvent.click(
      screen.getByRole("button", { name: "任务操作 接入真实 workspace nav" })
    );

    expect(await screen.findByText("重命名")).toBeInTheDocument();
    expect(screen.getAllByText("删除")).toHaveLength(1);
    expect(screen.getByTestId("task-rename-icon")).toBeInTheDocument();
    expect(screen.getByTestId("task-delete-icon")).toBeInTheDocument();
  });

  it("renames a task from the action menu", async () => {
    renameTaskMock.mockResolvedValue({
      id: "task-real-1",
      title: "新的任务名称"
    });
    renderWorkspaceSection({ collapsed: false });

    openTaskAction("重命名");
    const input = await screen.findByRole("textbox", { name: "任务名称" });
    fireEvent.change(input, { target: { value: " 新的任务名称 " } });
    fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));

    await waitFor(() => {
      expect(renameTaskMock).toHaveBeenCalledWith(
        "http://localhost:4000",
        "task-real-1",
        "新的任务名称"
      );
    });
    expect(screen.getByTestId("task-titles")).toHaveTextContent("新的任务名称");
  });

  it("confirms before deleting a task and clears its selection", async () => {
    deleteTaskMock.mockResolvedValue({ taskId: "task-real-1" });
    renderWorkspaceSection({ collapsed: false });

    openTaskAction("删除");
    expect(deleteTaskMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(deleteTaskMock).toHaveBeenCalledWith(
        "http://localhost:4000",
        "task-real-1"
      );
    });
    expect(screen.getByTestId("selected-task")).toBeEmptyDOMElement();
    expect(screen.getByTestId("task-ids")).toBeEmptyDOMElement();
  });

  it("keeps a running task after delete conflict", async () => {
    deleteTaskMock.mockRejectedValue(new Error("Task is running"));
    renderWorkspaceSection({ collapsed: false });

    openTaskAction("删除");
    fireEvent.click(await screen.findByRole("button", { name: "确认删除" }));

    expect(await screen.findByText("Task is running")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-task-task-real-1")).toBeInTheDocument();
  });
});

function openDeleteAction(): void {
  fireEvent.mouseEnter(screen.getByTestId("workspace-heading-workspace-real"));
  fireEvent.click(
    screen.getByRole("button", { name: "工作空间操作 Real Workspace" })
  );
  fireEvent.click(screen.getByText("删除"));
}

function openTaskAction(action: "重命名" | "删除"): void {
  fireEvent.mouseEnter(screen.getByTestId("workspace-task-task-real-1"));
  fireEvent.click(
    screen.getByRole("button", { name: "任务操作 接入真实 workspace nav" })
  );
  fireEvent.click(screen.getByText(action));
}

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
        <WorkspaceSectionTestState workspace={workspace} />
        <WorkspaceSection
          apiBaseUrl="http://localhost:4000"
          collapsed={collapsed}
          workspace={workspace}
        />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function WorkspaceSectionTestState({
  workspace
}: {
  workspace: WorkspaceSummary;
}) {
  const {
    state,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([workspace]);
    setActiveWorkspaceId(workspace.id);
    setActiveTaskId(workspace.tasks[0]?.id ?? "");
  }, [
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces,
    workspace
  ]);

  return (
    <>
      <span data-testid="selected-workspace">{state.activeWorkspaceId}</span>
      <span data-testid="selected-task">{state.activeTaskId}</span>
      <span data-testid="workspace-ids">
        {state.workspaces.map((item) => item.id).join(",")}
      </span>
      <span data-testid="task-ids">
        {state.workspaces.flatMap((item) => item.tasks.map((task) => task.id)).join(",")}
      </span>
      <span data-testid="task-titles">
        {state.workspaces.flatMap((item) => item.tasks.map((task) => task.title)).join(",")}
      </span>
    </>
  );
}
