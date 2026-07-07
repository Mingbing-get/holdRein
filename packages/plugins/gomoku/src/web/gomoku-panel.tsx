import { AimOutlined } from "@ant-design/icons";
import { Empty, Tag } from "antd";
import { useEffect, useState } from "react";

import { BOARD_SIZE, type Cell, type Position, type Stone } from "../shared";
import type { GomokuSessionStore, GomokuSnapshot } from "./session";

import "./gomoku-panel.css";

export interface GomokuPanelProps {
  readonly store: GomokuSessionStore;
}

export function GomokuPanel({ store }: GomokuPanelProps) {
  const [snapshot, setSnapshot] = useState<GomokuSnapshot>(store.getSnapshot());

  useEffect(
    () => store.subscribe(() => {
      setSnapshot(store.getSnapshot());
    }),
    [store]
  );

  const canUserMove =
    snapshot.phase === "waiting_for_user" &&
    snapshot.status.state === "playing";

  if (snapshot.phase === "idle") {
    return (
      <div className="gomoku-empty">
        <Empty
          description="Call gomoku_start_game to begin"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="gomoku-panel">
      <div className="gomoku-header">
        <div>
          <div className="gomoku-title">
            <AimOutlined aria-hidden="true" />
            Gomoku
          </div>
          <div className="gomoku-subtitle">
            {formatPhase(snapshot)}
          </div>
        </div>
        <Tag className="gomoku-turn">{formatTurn(snapshot.game.nextStone)}</Tag>
      </div>

      <div
        aria-label="Gomoku board"
        className="gomoku-board"
        role="grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`
        }}
      >
        {snapshot.game.board.flatMap((row, rowIndex) =>
          row.map((cell, columnIndex) => {
            const position = { column: columnIndex, row: rowIndex };
            const isDisabled = !canUserMove || cell !== null;
            const isLastMove =
              snapshot.lastMove?.position.column === columnIndex &&
              snapshot.lastMove.position.row === rowIndex;

            return (
              <button
                aria-label={formatCellLabel(position, cell)}
                className={[
                  "gomoku-cell",
                  isLastMove ? "gomoku-cell-last-move" : ""
                ].filter(Boolean).join(" ")}
                disabled={isDisabled}
                key={`${rowIndex}-${columnIndex}`}
                onClick={() => {
                  store.playUserMove(position);
                }}
                role="gridcell"
                type="button"
              >
                {cell ? (
                  <span
                    aria-hidden="true"
                    className={[
                      "gomoku-stone",
                      `gomoku-stone-${cell}`,
                      isLastMove ? "gomoku-stone-last-move" : ""
                    ].filter(Boolean).join(" ")}
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="gomoku-footer">
        <span>{snapshot.game.moves.length} moves</span>
        <span>User: {formatStone(snapshot.userStone)}</span>
        <span>Model: {formatStone(snapshot.modelStone)}</span>
      </div>

      {snapshot.lastError ? (
        <div className="gomoku-error" role="alert">
          {snapshot.lastError}
        </div>
      ) : null}
    </div>
  );
}

function formatCellLabel(position: Position, cell: Cell): string {
  const occupant = cell ? `${formatStone(cell)} stone` : "empty";
  return `Row ${position.row}, column ${position.column}, ${occupant}`;
}

function formatPhase(snapshot: GomokuSnapshot): string {
  if (snapshot.status.state === "won") {
    return `${formatStone(snapshot.status.winner ?? "black")} wins`;
  }

  if (snapshot.status.state === "draw") {
    return "Draw";
  }

  if (snapshot.phase === "waiting_for_user") {
    return "Waiting for your move";
  }

  if (snapshot.phase === "waiting_for_model") {
    return "Waiting for model move";
  }

  return "Ready";
}

function formatTurn(stone: Stone): string {
  return `${formatStone(stone)} to move`;
}

function formatStone(stone: Stone): string {
  return stone === "black" ? "Black" : "White";
}
