import { describe, expect, it, vi } from "vitest";

import { deleteWorkspace } from "./workspace-nav-api";

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
});
