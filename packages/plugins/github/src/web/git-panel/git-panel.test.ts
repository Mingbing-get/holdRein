// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createGitPanel, GitPanel } from ".";

vi.mock("@monaco-editor/react", () => ({
  DiffEditor: ({
    language,
    modified,
    options,
    original,
    theme,
  }: {
    language?: string;
    modified?: string;
    options?: Record<string, unknown>;
    original?: string;
    theme?: string;
  }) => React.createElement(
    "pre",
    {
      "data-language": language,
      "data-read-only": String(options?.readOnly),
      "data-render-side-by-side": String(options?.renderSideBySide),
      "data-theme": theme,
      "data-testid": "git-diff-editor"
    },
    `${original}\n---\n${modified}`
  )
}));

beforeAll(() => {
  const getComputedStyle = window.getComputedStyle.bind(window);

  class ResizeObserverStub {
    disconnect(): void {
      return undefined;
    }

    observe(): void {
      return undefined;
    }

    unobserve(): void {
      return undefined;
    }
  }

  vi.stubGlobal("getComputedStyle", (element: Element) =>
    getComputedStyle(element)
  );
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  vi.stubGlobal("MutationObserver", MutationObserverStub);
});

describe("createGitPanel", () => {
  it("wires the runtime request into a right panel", () => {
    const request = vi.fn();
    const panel = createGitPanel({ request });

    expect(panel.id).toBe("git-repository");
    expect(panel.title).toBe("Git");
    render(React.createElement(panel.Render, { messages: [], status: "idle" }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText("No workspace selected")).toBeInTheDocument();
  });
});

describe("GitPanel", () => {
  it("loads status and supports manual refresh", async () => {
    const request = createRequest(initializedStatus());
    renderPanel(request);

    expect(await screen.findByText("main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "变更 +3 -1" }))
      .toBeInTheDocument();
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/plugin/__github__plugin/status",
      query: { workspacePath: "/workspace" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh Git status" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("initializes an uninitialized workspace and reloads status", async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(result({ initialized: false }))
      .mockResolvedValueOnce(result(undefined))
      .mockResolvedValueOnce(result(initializedStatus({ hasChanges: false })));
    renderPanel(request);

    fireEvent.click(await screen.findByRole("button", { name: "Initialize Git" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/plugin/__github__plugin/initialize",
      body: JSON.stringify({ workspacePath: "/workspace" })
    })));
    expect(await screen.findByText("main")).toBeInTheDocument();
  });

  it("expands changed files and disables branch switching while dirty", async () => {
    const request = createRequest(initializedStatus());
    renderPanel(request);

    fireEvent.click(await screen.findByRole("button", { name: "变更 +3 -1" }));
    expect(screen.getByText("src/new.ts")).toBeInTheDocument();
    expect(screen.getByText("src/old.ts")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /当前分支/ }));
    const otherBranch = await screen.findByText("feature/demo");
    expect(otherBranch.closest("li")).toHaveClass("ant-dropdown-menu-item-disabled");
  });

  it("loads and toggles a file diff when clicking a changed file", async () => {
    const request = createRequest(initializedStatus());
    renderPanel(request);

    fireEvent.click(await screen.findByRole("button", { name: "变更 +3 -1" }));
    fireEvent.click(screen.getByRole("button", { name: "src/new.ts" }));
    const fileButton = screen.getByRole("button", { name: "src/new.ts" });
    expect(fileButton.querySelector(".git-panel__file-chevron"))
      .not.toBeInTheDocument();
    expect(fileButton).toHaveClass("git-panel__file-row--expanded");

    const editor = await screen.findByTestId("git-diff-editor");
    expect(editor).toHaveAttribute("data-language", "typescript");
    expect(editor).toHaveAttribute("data-read-only", "true");
    expect(editor).toHaveAttribute("data-render-side-by-side", "false");
    expect(editor).toHaveAttribute("data-theme", "vs");
    expect(editor).toHaveTextContent("before");
    expect(editor).toHaveTextContent("after");
    expect(editor).not.toHaveTextContent("diff --git");
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/plugin/__github__plugin/diff",
      query: {
        filePath: "src/new.ts",
        workspacePath: "/workspace"
      }
    });

    fireEvent.click(screen.getByRole("button", { name: "src/new.ts" }));
    expect(screen.queryByTestId("git-diff-editor")).not.toBeInTheDocument();
  });

  it("uses Monaco dark theme when the app is in dark mode", async () => {
    document.documentElement.dataset.themeMode = "dark";
    const request = createRequest(initializedStatus());
    renderPanel(request);

    fireEvent.click(await screen.findByRole("button", { name: "变更 +3 -1" }));
    fireEvent.click(screen.getByRole("button", { name: "src/new.ts" }));

    expect(await screen.findByTestId("git-diff-editor"))
      .toHaveAttribute("data-theme", "vs-dark");
    document.documentElement.dataset.themeMode = "light";
  });

  it("switches branches when there are no pending changes", async () => {
    const request = createRequest(initializedStatus({
      additions: 0,
      deletions: 0,
      files: [],
      hasChanges: false
    }));
    renderPanel(request);

    fireEvent.click(await screen.findByRole("button", { name: /当前分支/ }));
    fireEvent.click(await screen.findByText("feature/demo"));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/plugin/__github__plugin/branches/switch",
      body: JSON.stringify({
        workspacePath: "/workspace",
        branch: "feature/demo"
      })
    })));
  });

  it("submits commit without push", async () => {
    const request = createRequest(initializedStatus());
    renderPanel(request);
    fireEvent.click(await screen.findByRole("button", { name: "提交变更" }));
    expect(screen.getByRole("dialog", { name: "提交变更" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Commit message"), {
      target: { value: "save local work" }
    });
    fireEvent.click(screen.getByRole("button", { name: "提交" }));

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/plugin/__github__plugin/commits",
      body: JSON.stringify({
        workspacePath: "/workspace",
        message: "save local work",
        push: false
      })
    })));
  });

  it("requires a message and submits commit-and-push before refreshing", async () => {
    const request = createRequest(initializedStatus());
    renderPanel(request);
    fireEvent.click(await screen.findByRole("button", { name: "提交变更" }));

    const pushButton = screen.getByRole("button", { name: "提交并推送" });
    expect(pushButton).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Commit message"), {
      target: { value: "ship it" }
    });
    fireEvent.click(pushButton);

    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/plugin/__github__plugin/commits",
      body: JSON.stringify({
        workspacePath: "/workspace",
        message: "ship it",
        push: true
      })
    })));
  });
});

function renderPanel(request: ReturnType<typeof vi.fn>): void {
  render(
    React.createElement(GitPanel, {
      messages: [],
      request,
      status: "idle",
      workspacePath: "/workspace"
    })
  );
}

function createRequest(status: object) {
  return vi.fn(async (options: { path: string; query?: { filePath?: string } }) => {
    if (options.path.endsWith("/status")) {
      return result(status);
    }

    if (options.path.endsWith("/diff")) {
      return result({
        diff: [
          `diff --git a/${options.query?.filePath} b/${options.query?.filePath}`,
          "index 1111111..2222222 100644",
          `--- a/${options.query?.filePath}`,
          `+++ b/${options.query?.filePath}`,
          "@@ -1 +1 @@",
          "-before",
          "+after",
          ""
        ].join("\n")
      });
    }

    return result(undefined);
  });
}

function initializedStatus(overrides: Record<string, unknown> = {}) {
  return {
    initialized: true,
    currentBranch: "main",
    branches: ["feature/demo", "main"],
    additions: 3,
    deletions: 1,
    files: ["src/new.ts", "src/old.ts"],
    hasChanges: true,
    ...overrides
  };
}

function result<T>(data: T) {
  return { code: 0, data, msg: "Success" };
}

class MutationObserverStub {
  disconnect(): void {
    return undefined;
  }

  observe(): void {
    return undefined;
  }
}
