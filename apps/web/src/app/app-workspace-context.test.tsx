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
  });
});

function WorkspaceStateProbe() {
  const { state: uiState } = useAppUi();
  const {
    state: { activeTaskId, activeWorkspaceId, workspaces },
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
  }, [setActiveTaskId, setActiveWorkspaceId, setWorkspaces]);

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
    </>
  );
}
