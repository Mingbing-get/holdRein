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
import type {
  WorkspaceSettingResponse,
  WorkspaceSummary
} from "../workspace-nav-types";
import { WorkspaceSection } from ".";

const deleteWorkspaceMock = vi.fn();
const deleteTaskMock = vi.fn();
const fetchWorkspaceSettingMock = vi.fn();
const fetchWorkspaceTaskPageMock = vi.fn();
const renameTaskMock = vi.fn();
const updateWorkspaceSettingMock = vi.fn();

vi.mock("../../agent-messages", () => ({
  useAgentTasks: () => ({
    hasPendingApproval: () => false,
    hasUnreadCompletion: () => false
  })
}));

vi.mock("../workspace-nav-api", () => ({
  deleteTask: (...args: unknown[]) => deleteTaskMock(...args),
  deleteWorkspace: (...args: unknown[]) => deleteWorkspaceMock(...args),
  fetchWorkspaceSetting: (...args: unknown[]) =>
    fetchWorkspaceSettingMock(...args),
  fetchWorkspaceTaskPage: (...args: unknown[]) =>
    fetchWorkspaceTaskPageMock(...args),
  renameTask: (...args: unknown[]) => renameTaskMock(...args),
  updateWorkspaceSetting: (...args: unknown[]) =>
    updateWorkspaceSettingMock(...args)
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
  hasMore: false,
  id: "workspace-real",
  name: "Real Workspace",
  path: "/Users/mingbing/apps/real-workspace",
  tasks: []
};

describe("WorkspaceSection settings", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
  });

  afterEach(() => {
    cleanup();
    deleteTaskMock.mockReset();
    deleteWorkspaceMock.mockReset();
    fetchWorkspaceSettingMock.mockReset();
    fetchWorkspaceTaskPageMock.mockReset();
    renameTaskMock.mockReset();
    updateWorkspaceSettingMock.mockReset();
  });

  it("reads workspace settings from global state and refreshes after saving", async () => {
    fetchWorkspaceSettingMock.mockResolvedValue({
      ...createWorkspaceSetting(),
      setting: {
        activePlugins: ["base", "code"],
        activeSkills: ["planner", "reviewer"]
      }
    });
    updateWorkspaceSettingMock.mockResolvedValue({
      setting: {
        activePlugins: ["base", "code"],
        activeSkills: ["planner", "reviewer"]
      },
      workspaceId: "workspace-real"
    });
    renderWorkspaceSection(createWorkspaceSetting());

    openWorkspaceAction("设置");

    expect(await screen.findByText("Workspace 配置")).toBeInTheDocument();
    expect(fetchWorkspaceSettingMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole("radio", { name: "指定" })[1]!);
    fireEvent.mouseDown(await screen.findByLabelText("可用插件"));
    fireEvent.click(await screen.findByTitle("Code"));
    fireEvent.mouseDown(await screen.findByLabelText("可用技能"));
    fireEvent.click(await screen.findByTitle("planner"));
    fireEvent.click(await screen.findByTitle("reviewer"));
    fireEvent.click(screen.getByRole("button", { name: /提\s*交/ }));

    await waitFor(() => {
      expect(updateWorkspaceSettingMock).toHaveBeenCalledWith(
        "http://localhost:4000",
        "workspace-real",
        {
          activePlugins: ["base", "code"],
          activeSkills: ["planner", "reviewer"]
        }
      );
    });
    expect(fetchWorkspaceSettingMock).toHaveBeenCalledWith(
      "http://localhost:4000",
      "workspace-real"
    );
    await waitFor(() => {
      expect(screen.getByTestId("cached-workspace-skills")).toHaveTextContent(
        "planner,reviewer"
      );
    });
  });
});

function renderWorkspaceSection(workspaceSetting: WorkspaceSettingResponse) {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <WorkspaceSectionTestState workspaceSetting={workspaceSetting} />
        <WorkspaceSection
          apiBaseUrl="http://localhost:4000"
          collapsed={false}
          workspace={workspaceSummary}
        />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function WorkspaceSectionTestState({
  workspaceSetting
}: {
  workspaceSetting: WorkspaceSettingResponse;
}) {
  const {
    setActiveWorkspaceId,
    setWorkspaceSetting,
    setWorkspaces,
    state: { workspaceSettings }
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([workspaceSummary]);
    setWorkspaceSetting(workspaceSetting);
    setActiveWorkspaceId(workspaceSummary.id);
  }, [setActiveWorkspaceId, setWorkspaceSetting, setWorkspaces, workspaceSetting]);

  return (
    <span data-testid="cached-workspace-skills">
      {workspaceSettings["workspace-real"]?.setting.activeSkills?.join(",")}
    </span>
  );
}

function createWorkspaceSetting(): WorkspaceSettingResponse {
  return {
    pluginOptions: [
      { id: "base", name: "Base" },
      { id: "code", name: "Code" }
    ],
    setting: {
      activePlugins: ["base"]
    },
    skillOptions: [
      {
        id: "planner",
        name: "planner",
        path: "/workspace/.hold-rein/skills/planner",
        source: "workspace"
      },
      {
        id: "reviewer",
        name: "reviewer",
        path: "/Users/mingbing/.codex/skills/reviewer",
        source: "global"
      }
    ],
    workspaceId: "workspace-real"
  };
}

function openWorkspaceAction(action: string) {
  fireEvent.mouseEnter(screen.getByTestId("workspace-heading-workspace-real"));
  fireEvent.click(
    screen.getByRole("button", { name: "工作空间操作 Real Workspace" })
  );
  fireEvent.click(screen.getByText(action));
}
