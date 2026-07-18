// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppUiProvider, useAppUi } from "../../../app/app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../../app/app-workspace-context";
import { WorkspaceFileTree } from "./workspace-file-tree";

vi.mock("@monaco-editor/react", () => ({
  default: () => <pre data-testid="monaco-editor" />
}));

const fetchMock = vi.fn<typeof fetch>();

describe("WorkspaceFileTree actions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads an unopened folder before checking duplicate child folder names", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            { extension: "", kind: "folder", name: "src", path: "/workspace/src" }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "components",
              path: "/workspace/src/components"
            }
          ],
          parentPath: "/workspace/src"
        })
      );

    renderWorkspaceFileTree();
    fireEvent.click(await screen.findByRole("button", { name: "在 src 下新建文件夹" }));

    const dialog = await screen.findByRole("dialog", { name: "新建文件夹" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/file-system/entries?parentPath=%2Fworkspace%2Fsrc",
      { body: undefined, headers: undefined, method: "GET" }
    );
    fireEvent.change(within(dialog).getByLabelText("文件夹名称"), {
      target: { value: "components" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));

    expect(
      await within(dialog).findByText("当前目录已存在同名文件夹")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("marks delete actions as danger and other actions as themed", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        entries: [
          { extension: "", kind: "folder", name: "src", path: "/workspace/src" },
          { extension: ".txt", kind: "file", name: "notes.txt", path: "/workspace/notes.txt" }
        ],
        parentPath: "/workspace"
      })
    );

    renderWorkspaceFileTree();

    expect(await screen.findByRole("button", { name: "删除 src" })).toHaveClass(
      "workspace-file-tree__action--danger"
    );
    expect(screen.getByRole("button", { name: "在 src 下新建文件夹" })).toHaveClass(
      "workspace-file-tree__action--normal"
    );
    expect(screen.getByRole("button", { name: "下载 notes.txt" })).toHaveClass(
      "workspace-file-tree__action--normal"
    );
  });

  it("defines themed hover colors for normal and danger actions", () => {
    const cssSource = readFileSync(
      join(process.cwd(), "apps/web/src/modules/rightSide/file-tree/workspace-file-tree.css"),
      "utf8"
    );

    expect(cssSource).toContain(
      ".workspace-file-tree__row-actions .workspace-file-tree__action--normal.ant-btn:hover"
    );
    expect(cssSource).toContain("color: var(--app-color-primary);");
    expect(cssSource).toContain(
      ".workspace-file-tree__row-actions .workspace-file-tree__action--danger.ant-btn"
    );
    expect(cssSource).toContain("color: var(--app-color-danger);");
    expect(cssSource).toContain(
      ".workspace-file-tree__row-actions .workspace-file-tree__action--danger.ant-btn:hover"
    );
    expect(cssSource).toContain("color-mix(in srgb, var(--app-color-danger) 12%, transparent)");
  });
});

function renderWorkspaceFileTree() {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <ThemeStateSetup />
        <WorkspaceStateSetup />
        <WorkspaceFileTree />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function ThemeStateSetup() {
  const {
    state: { themeMode },
    toggleThemeMode
  } = useAppUi();

  useEffect(() => {
    if (themeMode !== "light") {
      toggleThemeMode();
    }
  }, [themeMode, toggleThemeMode]);

  return null;
}

function WorkspaceStateSetup() {
  const { setActiveWorkspaceId, setWorkspaces } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace",
        path: "/workspace",
        tasks: []
      }
    ]);
    setActiveWorkspaceId("workspace-one");
  }, [setActiveWorkspaceId, setWorkspaces]);

  return null;
}

function jsonResponse(data: unknown): Response {
  return {
    json: async () => ({ code: 0, data, msg: "ok" }),
    ok: true
  } as Response;
}
