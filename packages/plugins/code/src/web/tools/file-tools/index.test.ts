// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DeleteFileToolRender,
  EditFileToolRender,
  ReadFileToolRender,
  WriteFileToolRender
} from ".";
import type { WebPlugin } from "@hold-rein/plugin-web";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) =>
    React.createElement("pre", { "data-testid": "code-preview" }, value),
  DiffEditor: ({
    modified,
    original
  }: {
    modified: string;
    original: string;
  }) =>
    React.createElement(
      "pre",
      { "data-testid": "diff-preview" },
      `${original}\n---\n${modified}`
    )
}));

describe("file tool renders", () => {
  afterEach(() => {
    cleanup();
  });

  it("displays read, write, delete, and edit paths relative to the active workspace", () => {
    const absolutePath = "/Users/mingbing/apps/workspace-one/src/app.ts";
    const workspacePath = "/Users/mingbing/apps/workspace-one";

    renderFileTool(ReadFileToolRender, {
      path: absolutePath,
      workspacePath
    });
    renderFileTool(WriteFileToolRender, {
      content: "export {};",
      path: absolutePath,
      workspacePath
    });
    renderFileTool(DeleteFileToolRender, {
      path: absolutePath,
      workspacePath
    });
    renderFileTool(EditFileToolRender, {
      newText: "after",
      oldText: "before",
      path: absolutePath,
      workspacePath
    });

    expect(screen.getAllByText("src/app.ts")).toHaveLength(4);
    expect(screen.queryByText(absolutePath)).not.toBeInTheDocument();
  });
});

function renderFileTool(
  Render: React.ComponentType<WebPlugin.ToolRenderProps>,
  {
    workspacePath,
    ...args
  }: Record<string, unknown> & { workspacePath?: string | undefined }
) {
  return render(
    React.createElement(Render, {
      DefaultToolRender,
      renderDefaultChildren: () => null,
      toolCall: {
        arguments: args,
        id: "tool-call",
        name: "file_tool",
        type: "toolCall"
      },
      workspacePath
    })
  );
}

function DefaultToolRender({
  children,
  icon,
  title
}: WebPlugin.DefaultToolRenderProps) {
  return React.createElement(
    "section",
    null,
    React.createElement("h2", null, icon, title),
    children
  );
}
