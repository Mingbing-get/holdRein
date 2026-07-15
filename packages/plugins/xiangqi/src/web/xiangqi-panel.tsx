import { AimOutlined } from "@ant-design/icons";
import { Empty, Tag } from "antd";
import { useEffect, useState } from "react";

import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  type Cell,
  type Position,
  type XiangqiPiece,
  type XiangqiSide
} from "../shared";
import type { XiangqiSessionStore, XiangqiSnapshot } from "./session";

import "./xiangqi-panel.css";

export interface XiangqiPanelProps {
  readonly store: XiangqiSessionStore;
  readonly taskId?: string;
}

export function XiangqiPanel({ store, taskId }: XiangqiPanelProps) {
  const [selected, setSelected] = useState<Position | null>(null);
  const [snapshot, setSnapshot] = useState<XiangqiSnapshot>(store.getSnapshot());

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
      <div className="xiangqi-empty">
        <Empty
          description="调用 xiangqi_start_game 开始"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div className="xiangqi-panel">
      <div className="xiangqi-header">
        <div>
          <div className="xiangqi-title">
            <AimOutlined aria-hidden="true" />
            象棋
          </div>
          <div className="xiangqi-subtitle">{formatPhase(snapshot)}</div>
        </div>
        <Tag className="xiangqi-turn">{formatTurn(snapshot.game.nextSide)}</Tag>
      </div>

      <div
        aria-label="象棋棋盘"
        className="xiangqi-board"
        role="grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_COLUMNS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_ROWS}, minmax(0, 1fr))`
        }}
      >
        {snapshot.game.board.flatMap((row, rowIndex) =>
          row.map((cell, columnIndex) => {
            const position = { column: columnIndex, row: rowIndex };
            const isSelected =
              selected?.column === columnIndex && selected.row === rowIndex;
            const isLastMove =
              snapshot.lastMove?.to.column === columnIndex &&
              snapshot.lastMove.to.row === rowIndex;

            return (
              <button
                aria-label={formatCellLabel(position, cell)}
                className={[
                  "xiangqi-cell",
                  isSelected ? "xiangqi-cell-selected" : "",
                  isLastMove ? "xiangqi-cell-last-move" : ""
                ].filter(Boolean).join(" ")}
                disabled={!canUserMove}
                key={`${rowIndex}-${columnIndex}`}
                onClick={() => {
                  handleCellClick({
                    cell,
                    position,
                    selected,
                    setSelected,
                    snapshot,
                    store
                  });
                }}
                role="gridcell"
                type="button"
              >
                {cell ? (
                  <span
                    aria-hidden="true"
                    className={[
                      "xiangqi-piece",
                      `xiangqi-piece-${cell.side}`,
                      isLastMove ? "xiangqi-piece-last-move" : ""
                    ].filter(Boolean).join(" ")}
                  >
                    {formatPiece(cell)}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>

      <div className="xiangqi-footer">
        <span>{snapshot.game.moves.length} 手</span>
        <span>用户：{formatSide(snapshot.userSide)}</span>
        <span>模型：{formatSide(snapshot.modelSide)}</span>
      </div>

      {snapshot.lastError ? (
        <div className="xiangqi-error" role="alert">
          {snapshot.lastError}
        </div>
      ) : null}
    </div>
  );
}

interface HandleCellClickOptions {
  readonly cell: Cell;
  readonly position: Position;
  readonly selected: Position | null;
  readonly setSelected: (position: Position | null) => void;
  readonly snapshot: XiangqiSnapshot;
  readonly store: XiangqiSessionStore;
}

function handleCellClick({
  cell,
  position,
  selected,
  setSelected,
  snapshot,
  store
}: HandleCellClickOptions): void {
  if (!selected) {
    if (cell?.side === snapshot.userSide) {
      setSelected(position);
    }
    return;
  }

  if (cell?.side === snapshot.userSide) {
    setSelected(position);
    return;
  }

  store.playUserMove({ from: selected, to: position });
  setSelected(null);
}

function formatCellLabel(position: Position, cell: Cell): string {
  const occupant = cell
    ? `${formatSide(cell.side)}${formatPiece(cell)}`
    : "空位";
  return `第 ${position.row} 行，第 ${position.column} 列，${occupant}`;
}

function formatPhase(snapshot: XiangqiSnapshot): string {
  if (snapshot.status.state === "won") {
    return `${formatSide(snapshot.status.winner ?? "red")}获胜`;
  }

  if (snapshot.phase === "waiting_for_user") {
    return "等待你走棋";
  }

  if (snapshot.phase === "waiting_for_model") {
    return "等待模型走棋";
  }

  return "准备就绪";
}

function formatTurn(side: XiangqiSide): string {
  return `${formatSide(side)}行棋`;
}

function formatSide(side: XiangqiSide): string {
  return side === "red" ? "红方" : "黑方";
}

function formatPiece(piece: XiangqiPiece): string {
  const redNames = {
    advisor: "仕",
    cannon: "炮",
    chariot: "车",
    elephant: "相",
    general: "帅",
    horse: "马",
    rook: "车",
    soldier: "兵"
  } as const;
  const blackNames = {
    advisor: "士",
    cannon: "炮",
    chariot: "车",
    elephant: "象",
    general: "将",
    horse: "马",
    rook: "车",
    soldier: "卒"
  } as const;

  return piece.side === "red" ? redNames[piece.type] : blackNames[piece.type];
}
