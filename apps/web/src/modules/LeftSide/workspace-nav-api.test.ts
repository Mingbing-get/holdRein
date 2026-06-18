import { describe, expect, it, vi } from "vitest";

import {
  deleteTask,
  deleteWorkspace,
  fetchWorkspaceTaskPage,
  renameTask
} from "./workspace-nav-api";

describe("workspace navigation API", () => {
  it("deletes an encoded workspace id", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: { workspaceId: "workspace/one" },
        msg: "ok"
      }),
      ok: true
    });

    await expect(
      deleteWorkspace("http://localhost:4000/", "workspace/one", fetcher)
    ).resolves.toEqual({ workspaceId: "workspace/one" });

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/workspaces/workspace%2Fone",
      { method: "DELETE" }
    );
  });

  it("exposes the API error message", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 40900,
        data: null,
        msg: "Workspace has running tasks"
      }),
      ok: false
    });

    await expect(deleteWorkspace("", "workspace-one", fetcher)).rejects.toThrow(
      "Workspace has running tasks"
    );
  });

  it("renames an encoded task id", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: { id: "task/one", title: "Renamed" },
        msg: "ok"
      }),
      ok: true
    });

    await expect(
      renameTask("http://localhost:4000/", "task/one", "Renamed", fetcher)
    ).resolves.toEqual({ id: "task/one", title: "Renamed" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/agents/tasks/task%2Fone",
      {
        body: JSON.stringify({ title: "Renamed" }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
  });

  it("deletes an encoded task id", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: { taskId: "task/one" },
        msg: "ok"
      }),
      ok: true
    });

    await expect(
      deleteTask("http://localhost:4000/", "task/one", fetcher)
    ).resolves.toEqual({ taskId: "task/one" });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/agents/tasks/task%2Fone",
      { method: "DELETE" }
    );
  });

  it("fetches an encoded workspace task page after a cursor", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: {
          hasMore: false,
          tasks: [],
          workspaceId: "workspace/one"
        },
        msg: "ok"
      }),
      ok: true
    });

    await expect(
      fetchWorkspaceTaskPage(
        "http://localhost:4000/",
        "workspace/one",
        "2026-06-08T08:00:00.000Z",
        20,
        fetcher
      )
    ).resolves.toEqual({
      hasMore: false,
      tasks: [],
      workspaceId: "workspace/one"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/workspaces/workspace%2Fone/tasks?afterLastContinuedAt=2026-06-08T08%3A00%3A00.000Z&limit=20"
    );
  });
});
