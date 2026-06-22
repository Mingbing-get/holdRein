// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FileChangeSummaryTurnFooter,
  getFileChangeSummaryItems
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

describe("file change summary turn footer", () => {
  afterEach(() => {
    cleanup();
  });

  it("extracts edit, write, and delete file tool calls from assistant messages", () => {
    const items = getFileChangeSummaryItems([
      assistantMessage([
        toolCall("edit-1", "edit_file", {
          newText: "after",
          oldText: "before",
          path: "src/app.ts"
        }),
        toolCall("write-1", "write_file", {
          content: "export const value = 1;\n",
          path: "src/new.ts"
        }),
        toolCall("delete-1", "delete_file", {
          path: "src/old.ts"
        }),
        toolCall("read-1", "read_file", {
          path: "src/ignored.ts"
        })
      ])
    ]);

    expect(items).toEqual([
      {
        content: { modified: "after", original: "before", type: "diff" },
        operation: "edit",
        path: "src/app.ts"
      },
      {
        content: { text: "export const value = 1;\n", type: "code" },
        operation: "write",
        path: "src/new.ts"
      },
      {
        content: undefined,
        operation: "delete",
        path: "src/old.ts"
      }
    ]);
  });

  it("displays changed files relative to the active workspace", () => {
    render(
      React.createElement(FileChangeSummaryTurnFooter, {
        messages: [
          assistantMessage([
            toolCall("edit-1", "edit_file", {
              newText: "after",
              oldText: "before",
              path: "/Users/mingbing/apps/workspace-one/src/app.ts"
            })
          ])
        ],
        workspacePath: "/Users/mingbing/apps/workspace-one"
      })
    );

    expect(screen.getByText("src/app.ts")).toBeInTheDocument();
    expect(
      screen.queryByText("/Users/mingbing/apps/workspace-one/src/app.ts")
    ).not.toBeInTheDocument();
  });

  it("renders nothing when the turn has no file changes", () => {
    const { container } = render(
      React.createElement(FileChangeSummaryTurnFooter, {
        messages: [
          assistantMessage([
            toolCall("read-1", "read_file", { path: "src/app.ts" })
          ])
        ]
      })
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders grouped counts and expands editable previews", () => {
    render(
      React.createElement(FileChangeSummaryTurnFooter, {
        messages: [
          assistantMessage([
            toolCall("edit-1", "edit_file", {
              edits: [
                { newText: "one", oldText: "zero" },
                { newText: "three", oldText: "two" }
              ],
              path: "src/app.ts"
            }),
            toolCall("write-1", "write_file", {
              content: "created file",
              path: "src/new.ts"
            }),
            toolCall("delete-1", "delete_file", {
              path: "src/old.ts"
            })
          ])
        ]
      })
    );

    expect(
      screen.getByText("编辑1个文件、新增1个文件、删除1个文件")
    ).toBeInTheDocument();
    expect(screen.getByText("+2")).toHaveClass(
      "base-file-change-summary__stat--added"
    );
    expect(screen.getByText("-2")).toHaveClass(
      "base-file-change-summary__stat--removed"
    );
    expect(screen.getByText("+1")).toHaveClass(
      "base-file-change-summary__stat--added"
    );
    expect(screen.queryByTestId("diff-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /src\/app\.ts/ }));
    expect(screen.getByTestId("diff-preview")).toHaveTextContent("zero");
    expect(screen.getByTestId("diff-preview")).toHaveTextContent("three");

    fireEvent.click(screen.getByRole("button", { name: /src\/new\.ts/ }));
    expect(screen.getByTestId("code-preview")).toHaveTextContent("created file");

    fireEvent.click(screen.getByRole("button", { name: /src\/app\.ts/ }));
    expect(screen.queryByTestId("diff-preview")).not.toBeInTheDocument();
  });

  it("does not expand deleted files", () => {
    render(
      React.createElement(FileChangeSummaryTurnFooter, {
        messages: [
          assistantMessage([
            toolCall("delete-1", "delete_file", {
              path: "src/old.ts"
            })
          ])
        ]
      })
    );

    expect(screen.getByText("删除1个文件")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /src\/old\.ts/ })
    ).not.toBeInTheDocument();
    const deletedPath = screen.getByText("src/old.ts");
    expect(deletedPath).toBeInTheDocument();
    expect(deletedPath.closest(".base-file-change-summary__row")).toHaveClass(
      "base-file-change-summary__row--delete"
    );
  });
});

function assistantMessage(content: WebPlugin.ToolCall[]): WebPlugin.AssistantMessage {
  return {
    api: "openai-responses",
    content,
    id: `assistant-${content.map((item) => item.id).join("-")}`,
    model: "gpt-5",
    provider: "openai",
    role: "assistant",
    stopReason: "toolUse",
    timestamp: 1
  };
}

function toolCall(
  id: string,
  name: string,
  args: Record<string, unknown>
): WebPlugin.ToolCall {
  return {
    arguments: args,
    id,
    name,
    type: "toolCall"
  };
}
