// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { createInitialGame, type GomokuGame, type Stone } from "../shared";
import { GomokuPanel } from "./gomoku-panel";
import type { GomokuSessionStore, GomokuSnapshot } from "./session";

describe("GomokuPanel", () => {
  it("renders visible game labels in Chinese", () => {
    const store = createPanelStore(9);
    render(React.createElement(GomokuPanel, { store }));

    expect(screen.getByText("五子棋")).toBeInTheDocument();
    expect(screen.getByText("等待你落子")).toBeInTheDocument();
    expect(screen.getByText("黑棋落子")).toBeInTheDocument();
    expect(screen.getByText("0 手")).toBeInTheDocument();
    expect(screen.getByText("用户：黑棋")).toBeInTheDocument();
    expect(screen.getByText("模型：白棋")).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "五子棋棋盘" })).toBeInTheDocument();
  });

  it("updates both board rows and columns when the board size changes", () => {
    const store = createPanelStore(9);
    render(React.createElement(GomokuPanel, { store }));

    act(() => {
      store.setBoardSize(13);
    });

    const board = screen.getByRole("grid", { name: "五子棋棋盘" });
    expect(board).toHaveStyle({
      gridTemplateColumns: "repeat(13, minmax(0, 1fr))",
      gridTemplateRows: "repeat(13, minmax(0, 1fr))"
    });
  });
});

function createPanelStore(boardSize: number) {
  let snapshot = createSnapshot(createInitialGame({ boardSize }));
  const listeners = new Set<() => void>();

  const store: GomokuSessionStore & {
    readonly setBoardSize: (nextBoardSize: number) => void;
  } = {
    forcePlaceForTests() {
      return undefined;
    },
    getSnapshot() {
      return snapshot;
    },
    async loadTask() {
      return undefined;
    },
    async placeModelMove() {
      return "";
    },
    playUserMove() {
      return undefined;
    },
    async resumeGame() {
      return "";
    },
    setBoardSize(nextBoardSize) {
      snapshot = createSnapshot(createInitialGame({ boardSize: nextBoardSize }));
      for (const listener of listeners) {
        listener();
      }
    },
    async startGame() {
      return "";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };

  return store;
}

function createSnapshot(game: GomokuGame): GomokuSnapshot {
  const modelStone: Stone = "white";

  return {
    game,
    modelStone,
    phase: "waiting_for_user",
    status: { state: "playing" },
    userStone: "black"
  };
}
