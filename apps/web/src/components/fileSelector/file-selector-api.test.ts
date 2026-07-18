import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteFileSystemEntry } from "./file-selector-api";

describe("deleteFileSystemEntry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes an encoded file-system entry path", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          extension: ".ts",
          kind: "file",
          name: "old.ts",
          path: "/workspace/src/old.ts"
        },
        msg: "ok"
      }),
      ok: true
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await deleteFileSystemEntry("", "/workspace/src/old.ts");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/file-system/entries?entryPath=%2Fworkspace%2Fsrc%2Fold.ts",
      { method: "DELETE" }
    );
  });
});
