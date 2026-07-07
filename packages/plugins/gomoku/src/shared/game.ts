export const BOARD_SIZE = 15;
export const WIN_LENGTH = 5;

export type Stone = "black" | "white";
export type Cell = Stone | null;
export type GameState = "draw" | "playing" | "won";

export interface Position {
  readonly column: number;
  readonly row: number;
}

export interface GomokuGame {
  readonly board: readonly (readonly Cell[])[];
  readonly moves: readonly GomokuMove[];
  readonly nextStone: Stone;
}

export interface GomokuMove {
  readonly position: Position;
  readonly stone: Stone;
}

export interface GomokuStatus {
  readonly line?: readonly Position[];
  readonly state: GameState;
  readonly winner?: Stone;
}

interface Direction {
  readonly column: number;
  readonly row: number;
}

const DIRECTIONS: readonly Direction[] = [
  { column: 1, row: 0 },
  { column: 0, row: 1 },
  { column: 1, row: 1 },
  { column: 1, row: -1 }
];

export function createInitialGame(): GomokuGame {
  return {
    board: Array.from({ length: BOARD_SIZE }, () =>
      Array.from<Cell>({ length: BOARD_SIZE }).fill(null)
    ),
    moves: [],
    nextStone: "black"
  };
}

export function placeStone(
  game: GomokuGame,
  position: Position,
  stone: Stone
): GomokuGame {
  assertPositionInsideBoard(position);

  if (game.board[position.row]?.[position.column] !== null) {
    throw new Error("Intersection is already occupied.");
  }

  const board = game.board.map((row, rowIndex) =>
    row.map((cell, columnIndex) =>
      rowIndex === position.row && columnIndex === position.column
        ? stone
        : cell
    )
  );

  return {
    board,
    moves: [...game.moves, { position, stone }],
    nextStone: oppositeStone(stone)
  };
}

export function getGameStatus(game: GomokuGame): GomokuStatus {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const stone = game.board[row]?.[column];
      if (!stone) {
        continue;
      }

      for (const direction of DIRECTIONS) {
        const line = collectWinningLine(game, { column, row }, direction, stone);
        if (line) {
          return { line, state: "won", winner: stone };
        }
      }
    }
  }

  return game.moves.length === BOARD_SIZE * BOARD_SIZE
    ? { state: "draw" }
    : { state: "playing" };
}

export function isPositionInsideBoard(position: Position): boolean {
  return (
    Number.isInteger(position.column) &&
    Number.isInteger(position.row) &&
    position.column >= 0 &&
    position.column < BOARD_SIZE &&
    position.row >= 0 &&
    position.row < BOARD_SIZE
  );
}

export function oppositeStone(stone: Stone): Stone {
  return stone === "black" ? "white" : "black";
}

function assertPositionInsideBoard(position: Position): void {
  if (!isPositionInsideBoard(position)) {
    throw new Error("Move is outside the board.");
  }
}

function collectWinningLine(
  game: GomokuGame,
  start: Position,
  direction: Direction,
  stone: Stone
): readonly Position[] | null {
  const line: Position[] = [];

  for (let index = 0; index < WIN_LENGTH; index += 1) {
    const position = {
      column: start.column + direction.column * index,
      row: start.row + direction.row * index
    };

    if (!isPositionInsideBoard(position)) {
      return null;
    }

    if (game.board[position.row]?.[position.column] !== stone) {
      return null;
    }

    line.push(position);
  }

  return line;
}
