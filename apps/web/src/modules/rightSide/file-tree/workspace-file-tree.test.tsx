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

  it("loads directories one level at a time and opens supported files read-only", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
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
          entries: [
            {
              extension: ".ts",
              kind: "file",
              name: "main.ts",
              path: "/workspace/src/main.ts"
            }
          ],
          parentPath: "/workspace/src"
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

    expect(await screen.findByRole("treeitem", { name: "main.ts" })).toHaveStyle({
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
      "/api/v1/file-system/entries?parentPath=%2Fworkspace",
      {
        body: undefined,
        headers: undefined,
        method: "GET"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/file-system/entries?parentPath=%2Fworkspace%2Fsrc",
      {
        body: undefined,
        headers: undefined,
        method: "GET"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
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

  it("creates child folders from a folder action and refreshes that folder", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [],
          parentPath: "/workspace/src"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          extension: "",
          kind: "folder",
          name: "components",
          path: "/workspace/src/components"
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
    fireEvent.click(await screen.findByRole("treeitem", { name: "src" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "在 src 下新建文件夹" })
    );
    const dialog = await screen.findByRole("dialog", { name: "新建文件夹" });
    fireEvent.change(within(dialog).getByLabelText("文件夹名称"), {
      target: { value: "components" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/v1/file-system/folders", {
        body: JSON.stringify({
          name: "components",
          parentPath: "/workspace/src"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    });
    expect(await screen.findByRole("treeitem", { name: "components" })).toBeVisible();
  });

  it("uploads multiple files into a folder and refreshes that folder", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "docs",
              path: "/workspace/docs"
            }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(jsonResponse({ entries: [], parentPath: "/workspace/docs" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            extension: ".md",
            kind: "file",
            name: "a.md",
            path: "/workspace/docs/a.md"
          },
          {
            extension: ".txt",
            kind: "file",
            name: "b.txt",
            path: "/workspace/docs/b.txt"
          }
        ])
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: ".md",
              kind: "file",
              name: "a.md",
              path: "/workspace/docs/a.md"
            },
            {
              extension: ".txt",
              kind: "file",
              name: "b.txt",
              path: "/workspace/docs/b.txt"
            }
          ],
          parentPath: "/workspace/docs"
        })
      );

    renderWorkspaceFileTree();
    fireEvent.click(await screen.findByRole("treeitem", { name: "docs" }));
    const input = await screen.findByLabelText("上传文件到 docs");
    const files = [
      new File(["# A"], "a.md", { type: "text/markdown" }),
      new File(["B"], "b.txt", { type: "text/plain" })
    ];
    fireEvent.change(input, { target: { files } });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/v1/file-system/files?parentPath=%2Fworkspace%2Fdocs",
        expect.objectContaining({
          body: expect.any(FormData),
          method: "POST"
        })
      );
    });
    expect(await screen.findByRole("treeitem", { name: "a.md" })).toBeVisible();
    expect(await screen.findByRole("treeitem", { name: "b.txt" })).toBeVisible();
  });

  it("downloads files through the file action", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        entries: [
          {
            extension: ".txt",
            kind: "file",
            name: "notes.txt",
            path: "/workspace/notes.txt"
          }
        ],
        parentPath: "/workspace"
      })
    );
    renderWorkspaceFileTree();
    fireEvent.click(await screen.findByRole("button", { name: "下载 notes.txt" }));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/file-system/files/download?filePath=%2Fworkspace%2Fnotes.txt",
      {
        body: undefined,
        headers: undefined,
        method: "GET"
      }
    );
  });

  it("deletes files and folders after confirmation and refreshes the parent folder", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: "",
              kind: "folder",
              name: "src",
              path: "/workspace/src"
            }
          ],
          parentPath: "/workspace"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [
            {
              extension: ".ts",
              kind: "file",
              name: "old.ts",
              path: "/workspace/src/old.ts"
            }
          ],
          parentPath: "/workspace/src"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          extension: ".ts",
          kind: "file",
          name: "old.ts",
          path: "/workspace/src/old.ts"
        })
      )
      .mockResolvedValueOnce(jsonResponse({ entries: [], parentPath: "/workspace/src" }));
    renderWorkspaceFileTree();
    fireEvent.click(await screen.findByRole("treeitem", { name: "src" }));
    fireEvent.click(await screen.findByRole("button", { name: "删除 old.ts" }));
    const dialog = await screen.findByRole("dialog", { name: "删除确认" });
    fireEvent.click(within(dialog).getByRole("button", { name: "确定" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/v1/file-system/entries?entryPath=%2Fworkspace%2Fsrc%2Fold.ts",
        {
          body: undefined,
          headers: undefined,
          method: "DELETE"
        }
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole("treeitem", { name: "old.ts" })).not.toBeInTheDocument();
    });
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
