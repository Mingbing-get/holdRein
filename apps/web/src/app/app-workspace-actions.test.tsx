// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { WorkspaceSummary } from "../modules/leftSide/workspace-nav-types";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "./app-workspace-context";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("workspace actions state", () => {
  it("starts a new conversation in a specified workspace", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "new in two" }));

    expectSelection("workspace-two", "");
    expect(screen.getByTestId("new-conversation-workspace")).toHaveTextContent(
      "workspace-two"
    );
  });

  it("preserves selection when removing an inactive workspace", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "remove two" }));

    expectSelection("workspace-one", "task-one");
    expect(screen.getByTestId("workspace-ids")).toHaveTextContent("workspace-one");
  });

  it("selects the first remaining workspace and its first task", () => {
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "remove one" }));

    expectSelection("workspace-two", "task-two");
    expect(window.localStorage.getItem("hold-rein.active-workspace-id")).toBe(
      "workspace-two"
    );
  });

  it("selects an empty remaining workspace and clears the task", () => {
    renderActions([
      workspaceSummaries[0] as WorkspaceSummary,
      { ...(workspaceSummaries[1] as WorkspaceSummary), tasks: [] }
    ]);

    fireEvent.click(screen.getByRole("button", { name: "remove one" }));

    expectSelection("workspace-two", "");
  });

  it("clears workspace and task selection when none remain", () => {
    renderActions([workspaceSummaries[0] as WorkspaceSummary]);

    fireEvent.click(screen.getByRole("button", { name: "remove one" }));

    expectSelection("", "");
    expect(window.localStorage.getItem("hold-rein.active-workspace-id")).toBeNull();
  });
});

const workspaceSummaries: WorkspaceSummary[] = [
  {
    hasMore: false,
    id: "workspace-one",
    name: "Workspace One",
    path: "/workspace-one",
    tasks: [createTask("task-one")]
  },
  {
    hasMore: false,
    id: "workspace-two",
    name: "Workspace Two",
    path: "/workspace-two",
    tasks: [createTask("task-two")]
  }
];

function renderActions(workspaces = workspaceSummaries) {
  render(
    <AppWorkspaceProvider>
      <ActionsProbe workspaces={workspaces} />
    </AppWorkspaceProvider>
  );
}

function ActionsProbe({ workspaces }: { workspaces: WorkspaceSummary[] }) {
  const {
    removeWorkspace,
    startNewConversation,
    state,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces(workspaces);
    setActiveWorkspaceId("workspace-one");
    setActiveTaskId("task-one");
  }, [setActiveTaskId, setActiveWorkspaceId, setWorkspaces, workspaces]);

  return (
    <>
      <button onClick={() => startNewConversation("workspace-two")} type="button">
        new in two
      </button>
      <button onClick={() => removeWorkspace("workspace-one")} type="button">
        remove one
      </button>
      <button onClick={() => removeWorkspace("workspace-two")} type="button">
        remove two
      </button>
      <span data-testid="active-workspace">{state.activeWorkspaceId}</span>
      <span data-testid="active-task">{state.activeTaskId}</span>
      <span data-testid="new-conversation-workspace">
        {state.newConversationWorkspaceId}
      </span>
      <span data-testid="workspace-ids">
        {state.workspaces.map((workspace) => workspace.id).join(",")}
      </span>
    </>
  );
}

function expectSelection(workspaceId: string, taskId: string): void {
  expect(screen.getByTestId("active-workspace").textContent).toBe(workspaceId);
  expect(screen.getByTestId("active-task").textContent).toBe(taskId);
}

function createTask(id: string): WorkspaceSummary["tasks"][number] {
  return {
    id,
    initialUserMessage: id,
    lastContinuedAt: "2026-06-11T00:00:00.000Z",
    lastModelName: "gpt-4.1",
    lastModelProvider: "openai",
    lastModelProviderSource: "built_in",
    status: "completed",
    title: id
  };
}
