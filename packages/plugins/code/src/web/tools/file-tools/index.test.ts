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
    original,
    options
  }: {
    modified: string;
    original: string;
    options: { lineNumbers?: (lineNumber: number) => string };
  }) =>
    React.createElement(
      "pre",
      {
        "data-start-line": options.lineNumbers?.(1),
        "data-testid": "diff-preview"
      },
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

  it("starts edit diff line numbers at the matched source line", () => {
    renderFileTool(
      EditFileToolRender,
      {
        newText: "after",
        oldText: "before",
        path: "src/app.ts"
      },
      "Successfully replaced 1 block(s) in src/app.ts.\n\n@@ replacement 1, line 12 @@\n-before\n+after"
    );

    expect(screen.getByTestId("diff-preview")).toHaveAttribute(
      "data-start-line",
      "12"
    );
  });
});

function renderFileTool(
  Render: React.ComponentType<WebPlugin.ToolRenderProps>,
  {
    workspacePath,
    ...args
  }: Record<string, unknown> & { workspacePath?: string | undefined },
  resultText?: string
) {
  return render(
    React.createElement(Render, {
      DefaultToolRender,
      renderDefaultChildren: () => null,
      result: resultText
        ? {
            content: [{ text: resultText, type: "text" }],
            id: "tool-result",
            isError: false,
            role: "toolResult",
            timestamp: 1,
            toolCallId: "tool-call",
            toolName: "edit_file"
          }
        : undefined,
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
