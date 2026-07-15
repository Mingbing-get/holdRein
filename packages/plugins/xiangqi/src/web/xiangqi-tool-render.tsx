import { AimOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { BOARD_COLUMNS, BOARD_ROWS, type XiangqiPiece } from "../shared";

interface ToolPiece extends XiangqiPiece {
  readonly col: number;
  readonly row: number;
}

interface ToolMove {
  readonly from: {
    readonly col: number;
    readonly row: number;
  };
  readonly piece: XiangqiPiece;
  readonly to: {
    readonly col: number;
    readonly row: number;
  };
}

interface ToolResult {
  readonly boardColumns: number;
  readonly boardRows: number;
  readonly moveNumber?: number;
  readonly pendingUserMove?: ToolMove;
  readonly pieces: readonly ToolPiece[];
  readonly userMove?: ToolMove;
}

const TOOL_TITLES: Record<string, string> = {
  xiangqi_place_model_move: "模型走棋",
  xiangqi_resume_game: "继续游戏",
  xiangqi_start_game: "开局"
};

export function XiangqiToolRender(props: WebPlugin.ToolRenderProps) {
  const result = parseToolResult(getTextResult(props.result));
  const title = TOOL_TITLES[props.toolCall.name] ?? "象棋";
  const highlightKeys = getHighlightKeys(props.toolCall.name, props.toolCall.arguments, result);

  return (
    <props.DefaultToolRender icon={<AimOutlined aria-hidden="true" />} title={title}>
      {result ? (
        <div className="xiangqi-tool-render">
          <div
            aria-label="象棋工具结果棋盘"
            className="xiangqi-board xiangqi-tool-board"
            role="grid"
            style={{
              gridTemplateColumns: `repeat(${result.boardColumns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${result.boardRows}, minmax(0, 1fr))`
            }}
          >
            {createCells(result).map(({ cell, column, row }) => {
              const positionKey = getPositionKey(row, column);
              const isHighlighted = highlightKeys.has(positionKey);

              return (
                <div
                  aria-label={formatCellLabel(row, column, cell)}
                  className={[
                    "xiangqi-cell",
                    "xiangqi-tool-cell",
                    isHighlighted ? "xiangqi-cell-last-move" : ""
                  ].filter(Boolean).join(" ")}
                  key={positionKey}
                  role="gridcell"
                >
                  {cell ? (
                    <span
                      aria-hidden="true"
                      className={[
                        "xiangqi-piece",
                        `xiangqi-piece-${cell.side}`,
                        isHighlighted ? "xiangqi-piece-last-move" : ""
                      ].filter(Boolean).join(" ")}
                    >
                      {formatPiece(cell)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="xiangqi-tool-meta">
            {result.moveNumber ?? 0} 手
          </div>
        </div>
      ) : (
        <span className="xiangqi-tool-empty">等待棋局结果</span>
      )}
    </props.DefaultToolRender>
  );
}

export const xiangqiStartGameToolRender: WebPlugin.ToolRender = {
  Render: XiangqiToolRender,
  toolName: "xiangqi_start_game"
};

export const xiangqiPlaceModelMoveToolRender: WebPlugin.ToolRender = {
  Render: XiangqiToolRender,
  toolName: "xiangqi_place_model_move"
};

export const xiangqiResumeGameToolRender: WebPlugin.ToolRender = {
  Render: XiangqiToolRender,
  toolName: "xiangqi_resume_game"
};

function getTextResult(result: WebPlugin.ToolRenderProps["result"]): string {
  const text = result?.content.find((item) => item.type === "text");
  return typeof text?.text === "string" ? text.text : "";
}

function parseToolResult(value: string): ToolResult | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<ToolResult>;
    const boardColumns = parsed.boardColumns;
    const boardRows = parsed.boardRows;
    const pieces = parsed.pieces;
    if (
      !Number.isInteger(boardColumns) ||
      !Number.isInteger(boardRows) ||
      !Array.isArray(pieces)
    ) {
      return null;
    }

    return {
      boardColumns: boardColumns ?? BOARD_COLUMNS,
      boardRows: boardRows ?? BOARD_ROWS,
      pieces,
      ...(parsed.moveNumber === undefined
        ? {}
        : { moveNumber: parsed.moveNumber }),
      ...(parsed.pendingUserMove === undefined
        ? {}
        : { pendingUserMove: parsed.pendingUserMove }),
      ...(parsed.userMove === undefined ? {} : { userMove: parsed.userMove })
    };
  } catch {
    return null;
  }
}

function createCells(result: ToolResult) {
  const pieceMap = new Map<string, XiangqiPiece>();
  for (const piece of result.pieces) {
    pieceMap.set(getPositionKey(piece.row, piece.col), piece);
  }

  return Array.from(
    { length: result.boardColumns * result.boardRows },
    (_, index) => {
      const row = Math.floor(index / result.boardColumns);
      const column = index % result.boardColumns;

      return {
        cell: pieceMap.get(getPositionKey(row, column)) ?? null,
        column,
        row
      };
    }
  );
}

function getHighlightKeys(
  toolName: string,
  args: Record<string, unknown>,
  result: ToolResult | null
): Set<string> {
  const keys = new Set<string>();
  if (!result) {
    return keys;
  }

  addMoveKey(keys, result.userMove);
  addMoveKey(keys, result.pendingUserMove);

  if (
    (toolName === "xiangqi_place_model_move" ||
      toolName === "xiangqi_start_game") &&
    Number.isInteger(args.toRow) &&
    Number.isInteger(args.toColumn)
  ) {
    keys.add(getPositionKey(args.toRow as number, args.toColumn as number));
  }

  return keys;
}

function addMoveKey(keys: Set<string>, move?: ToolMove): void {
  if (move) {
    keys.add(getPositionKey(move.to.row, move.to.col));
  }
}

function getPositionKey(row: number, column: number): string {
  return `${row}-${column}`;
}

function formatCellLabel(
  row: number,
  column: number,
  cell: XiangqiPiece | null
): string {
  const occupant = cell
    ? `${cell.side === "red" ? "红方" : "黑方"}${formatPiece(cell)}`
    : "空位";
  return `第 ${row} 行，第 ${column} 列，${occupant}`;
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
