import { AimOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import type { Stone } from "../shared";

interface ToolStone {
  readonly col: number;
  readonly color: Stone;
  readonly row: number;
}

interface ToolResult {
  readonly boardSize: number;
  readonly moveNumber?: number;
  readonly pendingUserMove?: ToolStone;
  readonly stones: readonly ToolStone[];
  readonly userMove?: ToolStone;
}

const TOOL_TITLES: Record<string, string> = {
  gomoku_place_model_move: "模型落子",
  gomoku_resume_game: "继续游戏",
  gomoku_start_game: "开局"
};

export function GomokuToolRender(props: WebPlugin.ToolRenderProps) {
  const result = parseToolResult(getTextResult(props.result));
  const title = TOOL_TITLES[props.toolCall.name] ?? "五子棋";
  const highlightKeys = getHighlightKeys(props.toolCall.name, props.toolCall.arguments, result);

  return (
    <props.DefaultToolRender icon={<AimOutlined aria-hidden="true" />} title={title}>
      {result ? (
        <div className="gomoku-tool-render">
          <div
            aria-label="五子棋工具结果棋盘"
            className="gomoku-board gomoku-tool-board"
            role="grid"
            style={{
              gridTemplateColumns: `repeat(${result.boardSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${result.boardSize}, minmax(0, 1fr))`
            }}
          >
            {createCells(result).map(({ cell, column, row }) => {
              const positionKey = getPositionKey(row, column);
              const isHighlighted = highlightKeys.has(positionKey);

              return (
                <div
                  aria-label={formatCellLabel(row, column, cell)}
                  className={[
                    "gomoku-cell",
                    "gomoku-tool-cell",
                    isHighlighted ? "gomoku-cell-last-move" : ""
                  ].filter(Boolean).join(" ")}
                  key={positionKey}
                  role="gridcell"
                >
                  {cell ? (
                    <span
                      aria-hidden="true"
                      className={[
                        "gomoku-stone",
                        `gomoku-stone-${cell}`,
                        isHighlighted ? "gomoku-stone-last-move" : ""
                      ].filter(Boolean).join(" ")}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="gomoku-tool-meta">
            {result.moveNumber ?? result.stones.length} 手
          </div>
        </div>
      ) : (
        <span className="gomoku-tool-empty">等待棋局结果</span>
      )}
    </props.DefaultToolRender>
  );
}

export const gomokuStartGameToolRender: WebPlugin.ToolRender = {
  Render: GomokuToolRender,
  toolName: "gomoku_start_game"
};

export const gomokuPlaceModelMoveToolRender: WebPlugin.ToolRender = {
  Render: GomokuToolRender,
  toolName: "gomoku_place_model_move"
};

export const gomokuResumeGameToolRender: WebPlugin.ToolRender = {
  Render: GomokuToolRender,
  toolName: "gomoku_resume_game"
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
    const boardSize = parsed.boardSize;
    const stones = parsed.stones;
    if (
      typeof boardSize !== "number" ||
      !Number.isInteger(boardSize) ||
      !Array.isArray(stones)
    ) {
      return null;
    }

    return {
      boardSize,
      stones,
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
  const stoneMap = new Map<string, Stone>();
  for (const stone of result.stones) {
    stoneMap.set(getPositionKey(stone.row, stone.col), stone.color);
  }

  return Array.from({ length: result.boardSize * result.boardSize }, (_, index) => {
    const row = Math.floor(index / result.boardSize);
    const column = index % result.boardSize;

    return {
      cell: stoneMap.get(getPositionKey(row, column)) ?? null,
      column,
      row
    };
  });
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

  addStoneKey(keys, result.userMove);
  addStoneKey(keys, result.pendingUserMove);

  if (
    (toolName === "gomoku_place_model_move" || toolName === "gomoku_start_game") &&
    Number.isInteger(args.row) &&
    Number.isInteger(args.column)
  ) {
    keys.add(getPositionKey(args.row as number, args.column as number));
  }

  return keys;
}

function addStoneKey(keys: Set<string>, stone?: ToolStone): void {
  if (stone) {
    keys.add(getPositionKey(stone.row, stone.col));
  }
}

function getPositionKey(row: number, column: number): string {
  return `${row}-${column}`;
}

function formatCellLabel(row: number, column: number, cell: Stone | null): string {
  const occupant = cell ? `${cell === "black" ? "黑棋" : "白棋"}棋子` : "空位";
  return `第 ${row} 行，第 ${column} 列，${occupant}`;
}
