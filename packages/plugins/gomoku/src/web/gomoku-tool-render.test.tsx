// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";

import { GomokuToolRender } from "./gomoku-tool-render";

describe("GomokuToolRender", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a Chinese title and read-only board for model moves", () => {
    renderTool({
      args: { column: 8, row: 7 },
      resultText: JSON.stringify({
        boardSize: 9,
        moveNumber: 3,
        nextStone: "white",
        phase: "waiting_for_model",
        stones: [
          { col: 7, color: "black", row: 7 },
          { col: 8, color: "white", row: 7 },
          { col: 7, color: "black", row: 8 }
        ],
        status: { state: "playing" },
        userMove: { col: 7, color: "black", row: 8 }
      }),
      toolName: "gomoku_place_model_move"
    });

    expect(screen.getByRole("heading", { name: "模型落子" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "五子棋工具结果棋盘" })).toHaveStyle({
      gridTemplateColumns: "repeat(9, minmax(0, 1fr))",
      gridTemplateRows: "repeat(9, minmax(0, 1fr))"
    });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".gomoku-stone-last-move")).toHaveLength(2);
  });

  it("translates start and resume tool titles", () => {
    renderTool({
      args: {},
      resultText: JSON.stringify({
        boardSize: 9,
        moveNumber: 1,
        nextStone: "black",
        phase: "waiting_for_model",
        stones: [{ col: 4, color: "white", row: 4 }],
        status: { state: "playing" },
        userMove: { col: 4, color: "white", row: 4 }
      }),
      toolName: "gomoku_start_game"
    });
    renderTool({
      args: {},
      resultText: JSON.stringify({
        boardSize: 9,
        moveNumber: 1,
        nextStone: "black",
        phase: "waiting_for_model",
        stones: [{ col: 4, color: "white", row: 4 }],
        status: { state: "playing" },
        pendingUserMove: { col: 4, color: "white", row: 4 }
      }),
      toolName: "gomoku_resume_game"
    });

    expect(screen.getByRole("heading", { name: "开局" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "继续游戏" })).toBeInTheDocument();
  });
});

function renderTool({
  args,
  resultText,
  toolName
}: {
  args: Record<string, unknown>;
  resultText: string;
  toolName: string;
}) {
  return render(
    React.createElement(GomokuToolRender, {
      DefaultToolRender,
      renderDefaultChildren: () => null,
      result: {
        content: [{ text: resultText, type: "text" }],
        id: "tool-result",
        isError: false,
        role: "toolResult",
        timestamp: 1,
        toolCallId: "tool-call",
        toolName
      },
      toolCall: {
        arguments: args,
        id: "tool-call",
        name: toolName,
        type: "toolCall"
      }
    } satisfies WebPlugin.ToolRenderProps)
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
