// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { FileSelector } from "./file-selector";

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

const fetchMock = vi.fn<typeof fetch>();

describe("FileSelector delete actions", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("deletes an entry after confirmation and reloads the current directory", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            parentPath: "/workspace/src",
            entries: [
              {
                extension: ".ts",
                kind: "file",
                name: "old.ts",
                path: "/workspace/src/old.ts"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            parentPath: "/workspace/src",
            entries: []
          },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(
      <FileSelector
        apiBaseUrl=""
        open
        parentPath="/workspace/src"
        selectableTypes={[".ts"]}
        onConfirm={vi.fn()}
      />
    );

    const row = await screen.findByTestId("file-selector-entry-old.ts");

    expect(row.querySelector(".file-selector__entry-actions")).toContainElement(
      within(row).getByRole("button", { name: "删除 old.ts" })
    );

    fireEvent.click(within(row).getByRole("button", { name: "删除 old.ts" }));
    const confirmDialog = await screen.findByRole("tooltip");

    fireEvent.click(
      within(confirmDialog).getByRole("button", { name: /删\s*除/ })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/v1/file-system/entries?entryPath=%2Fworkspace%2Fsrc%2Fold.ts",
        { method: "DELETE" }
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/v1/file-system/entries?parentPath=%2Fworkspace%2Fsrc"
      );
    });
    expect(await screen.findByText("当前目录为空")).toBeInTheDocument();
  });
});
