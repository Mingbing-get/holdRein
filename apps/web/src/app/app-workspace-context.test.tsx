// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { AppUiProvider, useAppUi } from "./app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "./app-workspace-context";

describe("AppWorkspaceProvider", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("keeps workspace and active task state separate from UI state", () => {
    render(
      <AppUiProvider>
        <AppWorkspaceProvider>
          <WorkspaceStateProbe />
        </AppWorkspaceProvider>
      </AppUiProvider>
    );

    expect(screen.getByTestId("ui-has-workspaces")).toHaveTextContent("false");
    expect(screen.getByTestId("ui-has-active-task")).toHaveTextContent("false");
    expect(screen.getByTestId("workspace-count")).toHaveTextContent("1");
    expect(screen.getByTestId("active-workspace-id")).toHaveTextContent(
      "workspace-one"
    );
    expect(screen.getByTestId("active-task-id")).toHaveTextContent("task-one");
    expect(screen.getByTestId("active-agent")).toHaveTextContent(
      "anthropic/claude-3-5-sonnet"
    );
  });

  it("restores the active workspace and agent from local storage", () => {
    window.localStorage.setItem(
      "hold-rein.active-workspace-id",
      "workspace-two"
    );
    window.localStorage.setItem(
      "hold-rein.active-agent",
      JSON.stringify({
        modelId: "gpt-4.1",
        providerId: "openai"
      })
    );

    render(
      <AppWorkspaceProvider>
        <StoredWorkspaceStateProbe />
      </AppWorkspaceProvider>
    );

    expect(screen.getByTestId("stored-workspace-id")).toHaveTextContent(
      "workspace-two"
    );
    expect(screen.getByTestId("stored-agent")).toHaveTextContent(
      "openai/gpt-4.1"
    );
  });

  it("persists active workspace and agent changes to local storage", () => {
    render(
      <AppWorkspaceProvider>
        <PersistWorkspaceStateProbe />
      </AppWorkspaceProvider>
    );

    expect(window.localStorage.getItem("hold-rein.active-workspace-id")).toBe(
      "workspace-three"
    );
    expect(window.localStorage.getItem("hold-rein.active-agent")).toBe(
      JSON.stringify({
        modelId: "claude-opus-4",
        providerId: "anthropic"
      })
    );
  });

  it("removes persisted active workspace and agent values when cleared", () => {
    window.localStorage.setItem(
      "hold-rein.active-workspace-id",
      "workspace-four"
    );
    window.localStorage.setItem(
      "hold-rein.active-agent",
      JSON.stringify({
        modelId: "gpt-4.1",
        providerId: "openai"
      })
    );

    render(
      <AppWorkspaceProvider>
        <ClearWorkspaceStateProbe />
      </AppWorkspaceProvider>
    );

    expect(
      window.localStorage.getItem("hold-rein.active-workspace-id")
    ).toBeNull();
    expect(window.localStorage.getItem("hold-rein.active-agent")).toBeNull();
  });

  it("upserts a started task with a prompt title and replaces it later", () => {
    render(
      <AppWorkspaceProvider>
        <StartedTaskStateProbe />
      </AppWorkspaceProvider>
    );

    expect(screen.getByTestId("started-workspace-count")).toHaveTextContent("1");
    expect(screen.getByTestId("started-task-order")).toHaveTextContent(
      "task-new,task-old"
    );
    expect(screen.getByTestId("started-task-title")).toHaveTextContent(
      "Inspect the project"
    );
    expect(screen.getByTestId("started-active-workspace")).toHaveTextContent(
      "workspace-one"
    );
    expect(screen.getByTestId("started-active-task")).toHaveTextContent(
      "task-new"
    );
    expect(screen.getByTestId("generated-task-title")).toHaveTextContent(
      "Project inspection"
    );
  });

  it("stores workspace settings globally and drops them with their workspace", () => {
    render(
      <AppWorkspaceProvider>
        <WorkspaceSettingStateProbe />
      </AppWorkspaceProvider>
    );

    expect(screen.getByTestId("workspace-setting-plugins")).toHaveTextContent(
      "base"
    );
    expect(screen.getByTestId("workspace-setting-skills")).toHaveTextContent(
      "planner"
    );
    expect(screen.getByTestId("removed-workspace-setting")).toBeEmptyDOMElement();
  });
});

function WorkspaceStateProbe() {
  const { state: uiState } = useAppUi();
  const {
    state: { activeAgent, activeTaskId, activeWorkspaceId, workspaces },
    setActiveAgent,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/Users/mingbing/apps/workspace-one",
        tasks: []
      }
    ]);
    setActiveWorkspaceId("workspace-one");
    setActiveTaskId("task-one");
    setActiveAgent({
      modelId: "claude-3-5-sonnet",
      providerId: "anthropic"
    });
  }, [setActiveAgent, setActiveTaskId, setActiveWorkspaceId, setWorkspaces]);

  return (
    <>
      <span data-testid="ui-has-workspaces">
        {String("workspaces" in uiState)}
      </span>
      <span data-testid="ui-has-active-task">
        {String("activeTaskId" in uiState)}
      </span>
      <span data-testid="workspace-count">{workspaces.length}</span>
      <span data-testid="active-workspace-id">{activeWorkspaceId}</span>
      <span data-testid="active-task-id">{activeTaskId}</span>
      <span data-testid="active-agent">
        {activeAgent
          ? `${activeAgent.providerId}/${activeAgent.modelId}`
          : "none"}
      </span>
    </>
  );
}

function StoredWorkspaceStateProbe() {
  const {
    state: { activeAgent, activeWorkspaceId }
  } = useAppWorkspace();

  return (
    <>
      <span data-testid="stored-workspace-id">{activeWorkspaceId}</span>
      <span data-testid="stored-agent">
        {activeAgent
          ? `${activeAgent.providerId}/${activeAgent.modelId}`
          : "none"}
      </span>
    </>
  );
}

function PersistWorkspaceStateProbe() {
  const { setActiveAgent, setActiveWorkspaceId } = useAppWorkspace();

  useEffect(() => {
    setActiveWorkspaceId("workspace-three");
    setActiveAgent({
      modelId: "claude-opus-4",
      providerId: "anthropic"
    });
  }, [setActiveAgent, setActiveWorkspaceId]);

  return null;
}

function ClearWorkspaceStateProbe() {
  const { setActiveAgent, setActiveWorkspaceId } = useAppWorkspace();

  useEffect(() => {
    setActiveWorkspaceId("");
    setActiveAgent(null);
  }, [setActiveAgent, setActiveWorkspaceId]);

  return null;
}

function StartedTaskStateProbe() {
  const {
    state: { activeTaskId, activeWorkspaceId, workspaces },
    setWorkspaces,
    updateTaskTitle,
    upsertStartedTask
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/workspace-one",
        tasks: [
          {
            id: "task-old",
            initialUserMessage: "Old prompt",
            lastContinuedAt: "2026-06-08T00:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "Old title"
          }
        ]
      }
    ]);
    upsertStartedTask(
      {
        id: "workspace-one",
        name: "Workspace One",
        path: "/workspace-one"
      },
      {
        id: "task-new",
        initialUserMessage: "Inspect the project",
        lastContinuedAt: "2026-06-08T01:00:00.000Z",
        lastModelName: "gpt-4.1",
        lastModelProvider: "openai",
        lastModelProviderSource: "built_in",
        status: "running",
        title: "",
        workspaceId: "workspace-one"
      },
      "Inspect the project"
    );
  }, [setWorkspaces, upsertStartedTask]);

  useEffect(() => {
    if (activeTaskId === "task-new") {
      updateTaskTitle("task-new", "Project inspection");
    }
  }, [activeTaskId, updateTaskTitle]);

  const startedWorkspace = workspaces[0];
  const startedTask = startedWorkspace?.tasks[0];

  return (
    <>
      <span data-testid="started-workspace-count">{workspaces.length}</span>
      <span data-testid="started-task-order">
        {startedWorkspace?.tasks.map((task) => task.id).join(",")}
      </span>
      <span data-testid="started-task-title">
        {startedTask?.initialUserMessage}
      </span>
      <span data-testid="generated-task-title">{startedTask?.title}</span>
      <span data-testid="started-active-workspace">{activeWorkspaceId}</span>
      <span data-testid="started-active-task">{activeTaskId}</span>
    </>
  );
}

function WorkspaceSettingStateProbe() {
  const {
    removeWorkspace,
    setWorkspaceSetting,
    setWorkspaces,
    state: { workspaceSettings }
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/workspace-one",
        tasks: []
      },
      {
        hasMore: false,
        id: "workspace-two",
        name: "Workspace Two",
        path: "/workspace-two",
        tasks: []
      }
    ]);
    setWorkspaceSetting({
      pluginOptions: [{ id: "base", name: "Base" }],
      setting: {
        activePlugins: ["base"],
        activeSkills: ["planner"]
      },
      skillOptions: [
        {
          id: "planner",
          name: "planner",
          path: "/workspace-one/.hold-rein/skills/planner",
          source: "workspace"
        }
      ],
      workspaceId: "workspace-one"
    });
    setWorkspaceSetting({
      pluginOptions: [],
      setting: {},
      skillOptions: [],
      workspaceId: "workspace-two"
    });
    removeWorkspace("workspace-two");
  }, [removeWorkspace, setWorkspaceSetting, setWorkspaces]);

  return (
    <>
      <span data-testid="workspace-setting-plugins">
        {workspaceSettings["workspace-one"]?.setting.activePlugins?.join(",")}
      </span>
      <span data-testid="workspace-setting-skills">
        {workspaceSettings["workspace-one"]?.setting.activeSkills?.join(",")}
      </span>
      <span data-testid="removed-workspace-setting">
        {workspaceSettings["workspace-two"]?.workspaceId}
      </span>
    </>
  );
}
