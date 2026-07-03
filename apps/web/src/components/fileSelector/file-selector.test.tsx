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
import type { FileSelectorProps } from "./file-selector";

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

describe("FileSelector", () => {
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

  it("loads the root directory when opened and confirms a matching file path", async () => {
    const onConfirm = vi.fn();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/workspace",
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            },
            {
              extension: ".ts",
              kind: "file",
              name: "main.ts",
              path: "/workspace/main.ts"
            },
            {
              extension: ".md",
              kind: "file",
              name: "README.md",
              path: "/workspace/README.md"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <FileSelector
        apiBaseUrl="http://localhost:4000"
        open
        selectableTypes={[".ts"]}
        onConfirm={onConfirm}
      />
    );

    expect(await screen.findByText("src")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/file-system/entries"
    );

    fireEvent.click(screen.getByRole("button", { name: "main.ts file selectable" }));
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onConfirm).toHaveBeenCalledWith("/workspace/main.ts");

    const readmeRow = screen.getByTestId("file-selector-entry-README.md");
    expect(readmeRow).toHaveAttribute("aria-disabled", "true");
    expect(
      within(readmeRow).getByRole("button", { name: "README.md file unavailable" })
    ).toBeDisabled();
  });

  it("loads the next directory when a folder is opened", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            parentPath: "/workspace",
            entries: [
              {
                extension: "",
                kind: "folder",
                name: "src",
                path: "/workspace/src"
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
            parentPath: "/workspace/src",
            entries: [
              {
                extension: ".tsx",
                kind: "file",
                name: "App.tsx",
                path: "/workspace/src/App.tsx"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(
      <FileSelector
        apiBaseUrl=""
        open
        selectableTypes={[".tsx"]}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "src folder open" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/v1/file-system/entries?parentPath=%2Fworkspace%2Fsrc"
      );
    });
    expect(await screen.findByText("App.tsx")).toBeInTheDocument();
  });

  it("allows folders to be opened even when they cannot be selected", async () => {
    const onConfirm = vi.fn();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/workspace",
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <FileSelector
        apiBaseUrl=""
        open
        selectableTypes={[".json"]}
        onConfirm={onConfirm}
      />
    );

    const row = await screen.findByTestId("file-selector-entry-src");

    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(within(row).getByRole("button", { name: "src folder open" })).toBeEnabled();
  });

  it("marks a selected folder action with the theme primary color class", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/workspace",
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <FileSelector
        apiBaseUrl=""
        open
        selectableTypes={["folder"]}
        onConfirm={vi.fn()}
      />
    );

    const row = await screen.findByTestId("file-selector-entry-src");
    const selectFolderButton = within(row).getByRole("button", {
      name: "src folder selectable"
    });

    fireEvent.click(selectFolderButton);

    expect(selectFolderButton).toHaveClass(
      "file-selector__select-folder-button--selected"
    );
  });

  it("confirms multiple selected paths when multiple is true", async () => {
    const onConfirm = vi.fn();
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/workspace",
          entries: [
            {
              extension: ".ts",
              kind: "file",
              name: "main.ts",
              path: "/workspace/main.ts"
            },
            {
              extension: ".tsx",
              kind: "file",
              name: "App.tsx",
              path: "/workspace/App.tsx"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <FileSelector
        apiBaseUrl=""
        multiple
        open
        selectableTypes={[".ts", ".tsx"]}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "main.ts file selectable" }));
    fireEvent.click(screen.getByRole("button", { name: "App.tsx file selectable" }));
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    expect(onConfirm).toHaveBeenCalledWith([
      "/workspace/main.ts",
      "/workspace/App.tsx"
    ]);
  });

  it("does not load directories while closed", () => {
    render(
      <FileSelector
        apiBaseUrl=""
        open={false}
        selectableTypes={[".ts"]}
        onConfirm={vi.fn()}
      />
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("applies the provided modal z-index", async () => {
    fetchMock.mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          parentPath: "/workspace",
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
        selectableTypes={["folder"]}
        zIndex={1100}
        onConfirm={vi.fn()}
      />
    );

    const modalWrap = (
      await screen.findByRole("dialog", { name: "选择文件" })
    ).closest(".ant-modal-wrap");

    expect(modalWrap).toHaveStyle({ zIndex: "1100" });
  });

  it("keeps callback types aligned with the multiple option", () => {
    const singleProps: FileSelectorProps = {
      onConfirm: (path: string) => path,
      open: true,
      selectableTypes: [".ts"]
    };
    const multiProps: FileSelectorProps = {
      multiple: true,
      onConfirm: (paths: string[]) => paths,
      open: true,
      selectableTypes: [".ts"]
    };

    expect(singleProps.open).toBe(true);
    expect(multiProps.multiple).toBe(true);
  });
});
