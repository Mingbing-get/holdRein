// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppUiProvider, useAppUi } from "../../../app/app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../../app/app-workspace-context";
import { WorkspaceFileTree } from "./workspace-file-tree";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    language,
    options,
    theme,
    value
  }: {
    language?: string;
    options?: Record<string, unknown>;
    theme?: string;
    value?: string;
  }) => (
    <pre
      data-language={language}
      data-line-numbers={String(options?.lineNumbers)}
      data-read-only={String(options?.readOnly)}
      data-theme={theme}
      data-testid="monaco-editor"
    >
      {value}
    </pre>
  )
}));

const fetchMock = vi.fn<typeof fetch>();

describe("WorkspaceFileTree", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("loads the active workspace tree, toggles folders, and opens supported files read-only", async () => {
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
                  path: "/workspace/src/main.ts"
                }
              ],
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            },
            {
              extension: ".png",
              kind: "file",
              name: "logo.png",
              path: "/workspace/logo.png"
            }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          content: "const answer: number = 42;\n",
          filePath: "/workspace/src/main.ts"
        })
      );

    renderWorkspaceFileTree();

    expect(await screen.findByRole("treeitem", { name: "src" })).toHaveStyle({
      paddingLeft: "8px"
    });

    expect(screen.queryByRole("treeitem", { name: "main.ts" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("treeitem", { name: "src" }));

    expect(screen.getByRole("treeitem", { name: "main.ts" })).toHaveStyle({
      paddingLeft: "24px"
    });

    fireEvent.click(screen.getByRole("treeitem", { name: "main.ts" }));

    const editor = await screen.findByTestId("monaco-editor");
    expect(editor).toHaveTextContent("const answer: number = 42;");
    expect(editor).toHaveAttribute("data-read-only", "true");
    expect(editor).toHaveAttribute("data-line-numbers", "on");
    expect(editor).toHaveAttribute("data-language", "typescript");
    expect(editor).toHaveAttribute("data-theme", "vs");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/file-system/entries/recursive?ignores=node_modules&parentPath=%2Fworkspace&useGitIgnore=true",
      {
        body: undefined,
        headers: undefined,
        method: "GET"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/file-system/file-content?filePath=%2Fworkspace%2Fsrc%2Fmain.ts",
      {
        body: undefined,
        headers: undefined,
        method: "GET"
      }
    );

    fireEvent.click(screen.getByRole("treeitem", { name: "main.ts" }));

    await waitFor(() => {
      expect(screen.queryByTestId("monaco-editor")).not.toBeInTheDocument();
    });
  });

  it("ignores unsupported file formats", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        entries: [
          {
            extension: ".png",
            kind: "file",
            name: "logo.png",
            path: "/workspace/logo.png"
          }
        ],
        parentPath: "/workspace"
      })
    );

    renderWorkspaceFileTree();

    fireEvent.click(await screen.findByRole("treeitem", { name: "logo.png" }));

    expect(screen.queryByTestId("monaco-editor")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses Monaco's dark theme when the app theme is dark", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: ".ts",
              kind: "file",
              name: "main.ts",
              path: "/workspace/main.ts"
            }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          content: "export const mode = 'dark';\n",
          filePath: "/workspace/main.ts"
        })
      );

    renderWorkspaceFileTree({ themeMode: "dark" });

    fireEvent.click(await screen.findByRole("treeitem", { name: "main.ts" }));

    expect(await screen.findByTestId("monaco-editor")).toHaveAttribute(
      "data-theme",
      "vs-dark"
    );
  });
});

interface RenderWorkspaceFileTreeOptions {
  themeMode?: "dark" | "light";
}

function renderWorkspaceFileTree(
  options: RenderWorkspaceFileTreeOptions = {}
) {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <ThemeStateSetup themeMode={options.themeMode ?? "light"} />
        <WorkspaceStateSetup />
        <WorkspaceFileTree />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function ThemeStateSetup({ themeMode }: { themeMode: "dark" | "light" }) {
  const {
    state: { themeMode: currentThemeMode },
    toggleThemeMode
  } = useAppUi();

  useEffect(() => {
    if (currentThemeMode !== themeMode) {
      toggleThemeMode();
    }
  }, [currentThemeMode, themeMode, toggleThemeMode]);

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
    json: async () => ({
      code: 0,
      data,
      msg: "ok"
    }),
    ok: true
  } as Response;
}
