// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import type { AgentTaskState } from "../agent-messages";
import { useWorkspaceFileSuggestions } from "./use-workspace-file-suggestions";

describe("useWorkspaceFileSuggestions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReturnValue(new Promise(() => undefined));
  });

  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("loads selected workspace file suggestions and refreshes after a task completes", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              children: [
                {
                  extension: ".ts",
                  kind: "file",
                  name: "main.ts",
                  path: "/Users/mingbing/apps/workspace-one/src/main.ts"
                }
              ],
              extension: "",
              kind: "folder",
              name: "src",
              path: "/Users/mingbing/apps/workspace-one/src"
            }
          ],
          parentPath: "/Users/mingbing/apps/workspace-one"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: ".md",
              kind: "file",
              name: "README.md",
              path: "/Users/mingbing/apps/workspace-one/README.md"
            }
          ],
          parentPath: "/Users/mingbing/apps/workspace-one"
        })
      );
    const view = renderHookProbe("running");

    await waitFor(() => {
      expect(readSuggestions()).toEqual([
        {
          children: [
            {
              label: "main.ts",
              value: "/src/main.ts"
            }
          ],
          label: "src/",
          value: "/src/"
        }
      ]);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/file-system/entries/recursive?parentPath=%2FUsers%2Fmingbing%2Fapps%2Fworkspace-one&ignores=node_modules&useGitIgnore=true"
    );

    view.rerender(getHookProbe("completed"));

    await waitFor(() => {
      expect(readSuggestions()).toEqual([
        {
          label: "README.md",
          value: "/README.md"
        }
      ]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function renderHookProbe(taskStatus: AgentTaskState["status"]) {
  return render(getHookProbe(taskStatus));
}

function getHookProbe(taskStatus: AgentTaskState["status"]) {
  return (
    <AppWorkspaceProvider>
      <WorkspaceStateSetup />
      <SuggestionsProbe taskStatus={taskStatus} />
    </AppWorkspaceProvider>
  );
}

function WorkspaceStateSetup() {
  const { setActiveWorkspaceId, setWorkspaces } = useAppWorkspace();

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
  }, [setActiveWorkspaceId, setWorkspaces]);

  return null;
}

function SuggestionsProbe({
  taskStatus
}: {
  taskStatus: AgentTaskState["status"];
}) {
  const suggestionGroups = useWorkspaceFileSuggestions(
    "http://localhost:4000",
    taskStatus
  );
  const suggestions = suggestionGroups.flatMap((group) =>
    group.suggestions
  );

  return <div data-testid="suggestions">{JSON.stringify(suggestions)}</div>;
}

function jsonResponse(data: unknown): Response {
  return {
    json: async () => ({
      code: 0,
      data,
      msg: "ok"
    }),
    ok: true
  } as Response;
}

function readSuggestions(): unknown {
  return JSON.parse(screen.getByTestId("suggestions").textContent ?? "[]");
}
