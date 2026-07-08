import { AimOutlined } from "@ant-design/icons";
import { Empty, Tag } from "antd";
import { useEffect, useState } from "react";

import { type Cell, type Position, type Stone } from "../shared";
import type { GomokuSessionStore, GomokuSnapshot } from "./session";

import "./gomoku-panel.css";

export interface GomokuPanelProps {
  readonly store: GomokuSessionStore;
  readonly taskId?: string;
}

export function GomokuPanel({ store, taskId }: GomokuPanelProps) {
  const [snapshot, setSnapshot] = useState<GomokuSnapshot>(store.getSnapshot());

  useEffect(
    () => store.subscribe(() => {
      setSnapshot(store.getSnapshot());
    }),
    [store]
  );

  useEffect(() => {
    if (taskId) {
      void store.loadTask(taskId);
    }
  }, [store, taskId]);

  const canUserMove =
    snapshot.phase === "waiting_for_user" &&
    snapshot.status.state === "playing";

  if (snapshot.phase === "idle") {
    return (
      <div className="gomoku-empty">
        <Empty
          description="调用 gomoku_start_game 开始"
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
            五子棋
          </div>
          <div className="gomoku-subtitle">
            {formatPhase(snapshot)}
          </div>
        </div>
        <Tag className="gomoku-turn">{formatTurn(snapshot.game.nextStone)}</Tag>
      </div>

      <div
        aria-label="五子棋棋盘"
        className="gomoku-board"
        role="grid"
        style={{
          gridTemplateColumns: `repeat(${snapshot.game.boardSize}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${snapshot.game.boardSize}, minmax(0, 1fr))`
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
        <span>{snapshot.game.moves.length} 手</span>
        <span>用户：{formatStone(snapshot.userStone)}</span>
        <span>模型：{formatStone(snapshot.modelStone)}</span>
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
  const occupant = cell ? `${formatStone(cell)}棋子` : "空位";
  return `第 ${position.row} 行，第 ${position.column} 列，${occupant}`;
}

function formatPhase(snapshot: GomokuSnapshot): string {
  if (snapshot.status.state === "won") {
    return `${formatStone(snapshot.status.winner ?? "black")}获胜`;
  }

  if (snapshot.status.state === "draw") {
    return "平局";
  }

  if (snapshot.phase === "waiting_for_user") {
    return "等待你落子";
  }

  if (snapshot.phase === "waiting_for_model") {
    return "等待模型落子";
  }

  return "准备就绪";
}

function formatTurn(stone: Stone): string {
  return `${formatStone(stone)}落子`;
}

function formatStone(stone: Stone): string {
  return stone === "black" ? "黑棋" : "白棋";
}
