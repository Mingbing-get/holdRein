export const BOARD_COLUMNS = 9;
export const BOARD_ROWS = 10;

export type XiangqiSide = "black" | "red";
export type XiangqiPieceType =
  | "advisor"
  | "cannon"
  | "chariot"
  | "elephant"
  | "general"
  | "horse"
  | "rook"
  | "soldier";
export type GameState = "playing" | "won";

export interface Position {
  readonly column: number;
  readonly row: number;
}

export interface XiangqiPiece {
  readonly side: XiangqiSide;
  readonly type: XiangqiPieceType;
}

export type Cell = XiangqiPiece | null;

export interface XiangqiMove {
  readonly captured?: XiangqiPiece;
  readonly from: Position;
  readonly piece: XiangqiPiece;
  readonly to: Position;
}

export interface XiangqiGame {
  readonly board: readonly (readonly Cell[])[];
  readonly moves: readonly XiangqiMove[];
  readonly nextSide: XiangqiSide;
}

export interface XiangqiStatus {
  readonly state: GameState;
  readonly winner?: XiangqiSide;
}

export type XiangqiPhase =
  | "finished"
  | "idle"
  | "waiting_for_model"
  | "waiting_for_user";

export interface PersistedXiangqiTaskGame {
  readonly game: XiangqiGame;
  readonly modelSide: XiangqiSide;
  readonly pendingUserMove?: XiangqiMove;
  readonly phase: XiangqiPhase;
  readonly savedAt: string;
  readonly taskId: string;
  readonly version: 1;
}

export interface PiecePlacement {
  readonly piece: XiangqiPiece;
  readonly position: Position;
}

export interface CreateInitialGameOptions {
  readonly pieces?: readonly PiecePlacement[];
}

export interface MovePieceOptions {
  readonly from: Position;
  readonly to: Position;
}

export function createInitialGame(
  options: CreateInitialGameOptions = {}
): XiangqiGame {
  const board = createEmptyBoard();
  const placements = options.pieces ?? createStandardPlacements();

  for (const placement of placements) {
    assertPositionInsideBoard(placement.position);
    const row = board[placement.position.row];
    if (!row) {
      throw new Error("Move is outside the board.");
    }
    row[placement.position.column] = placement.piece;
  }

  return {
    board,
    moves: [],
    nextSide: "red"
  };
}

export function movePiece(
  game: XiangqiGame,
  { from, to }: MovePieceOptions
): XiangqiGame {
  assertPositionInsideBoard(from);
  assertPositionInsideBoard(to);

  const piece = game.board[from.row]?.[from.column];
  if (!piece) {
    throw new Error("No piece at source position.");
  }

  if (piece.side !== game.nextSide) {
    throw new Error(`It is ${game.nextSide}'s turn.`);
  }

  const target = game.board[to.row]?.[to.column] ?? null;
  if (target?.side === piece.side) {
    throw new Error("Cannot capture your own piece.");
  }

  assertLegalPieceMove(game, piece, from, to, target);

  const nextBoard = game.board.map((row) => row.slice());
  const fromRow = nextBoard[from.row];
  const toRow = nextBoard[to.row];
  if (!fromRow || !toRow) {
    throw new Error("Move is outside the board.");
  }
  fromRow[from.column] = null;
  toRow[to.column] = piece;

  if (generalsFace(nextBoard)) {
    throw new Error("Generals cannot face each other.");
  }

  return {
    board: nextBoard,
    moves: [
      ...game.moves,
      {
        ...(target === null ? {} : { captured: target }),
        from,
        piece,
        to
      }
    ],
    nextSide: oppositeSide(piece.side)
  };
}

export function getGameStatus(game: XiangqiGame): XiangqiStatus {
  const redGeneral = findGeneral(game.board, "red");
  const blackGeneral = findGeneral(game.board, "black");

  if (!redGeneral) {
    return { state: "won", winner: "black" };
  }

  if (!blackGeneral) {
    return { state: "won", winner: "red" };
  }

  return { state: "playing" };
}

export function isPositionInsideBoard(position: Position): boolean {
  return (
    Number.isInteger(position.column) &&
    Number.isInteger(position.row) &&
    position.column >= 0 &&
    position.column < BOARD_COLUMNS &&
    position.row >= 0 &&
    position.row < BOARD_ROWS
  );
}

export function oppositeSide(side: XiangqiSide): XiangqiSide {
  return side === "red" ? "black" : "red";
}

function createEmptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from<Cell>({ length: BOARD_COLUMNS }).fill(null)
  );
}

function createStandardPlacements(): PiecePlacement[] {
  return [
    ...createBackRank("black", 0),
    ...createBackRank("red", 9),
    ...[1, 7].map((column) => ({
      piece: piece("black", "cannon"),
      position: { column, row: 2 }
    })),
    ...[1, 7].map((column) => ({
      piece: piece("red", "cannon"),
      position: { column, row: 7 }
    })),
    ...[0, 2, 4, 6, 8].map((column) => ({
      piece: piece("black", "soldier"),
      position: { column, row: 3 }
    })),
    ...[0, 2, 4, 6, 8].map((column) => ({
      piece: piece("red", "soldier"),
      position: { column, row: 6 }
    }))
  ];
}

function createBackRank(side: XiangqiSide, row: number): PiecePlacement[] {
  const types: readonly XiangqiPieceType[] = [
    "rook",
    "horse",
    "elephant",
    "advisor",
    "general",
    "advisor",
    "elephant",
    "horse",
    "rook"
  ];

  return types.map((type, column) => ({
    piece: piece(side, type),
    position: { column, row }
  }));
}

function piece(side: XiangqiSide, type: XiangqiPieceType): XiangqiPiece {
  return { side, type };
}

function assertLegalPieceMove(
  game: XiangqiGame,
  pieceToMove: XiangqiPiece,
  from: Position,
  to: Position,
  target: Cell
): void {
  const deltaColumn = to.column - from.column;
  const deltaRow = to.row - from.row;
  const absColumn = Math.abs(deltaColumn);
  const absRow = Math.abs(deltaRow);

  if (pieceToMove.type === "rook" || pieceToMove.type === "chariot") {
    assertRookMove(game, from, to);
    return;
  }

  if (pieceToMove.type === "cannon") {
    assertCannonMove(game, from, to, target);
    return;
  }

  if (pieceToMove.type === "horse") {
    assertHorseMove(game, from, to, absColumn, absRow, deltaColumn, deltaRow);
    return;
  }

  if (pieceToMove.type === "elephant") {
    assertElephantMove(game, pieceToMove.side, from, to, absColumn, absRow);
    return;
  }

  if (pieceToMove.type === "advisor") {
    assertAdvisorMove(pieceToMove.side, to, absColumn, absRow);
    return;
  }

  if (pieceToMove.type === "general") {
    assertGeneralMove(pieceToMove.side, to, absColumn, absRow);
    return;
  }

  assertSoldierMove(pieceToMove.side, from, absColumn, deltaRow);
}

function assertRookMove(game: XiangqiGame, from: Position, to: Position): void {
  if (from.row !== to.row && from.column !== to.column) {
    throw new Error("Rook must move in a straight line.");
  }

  if (countPiecesBetween(game.board, from, to) !== 0) {
    throw new Error("Rook path must be clear.");
  }
}

function assertCannonMove(
  game: XiangqiGame,
  from: Position,
  to: Position,
  target: Cell
): void {
  if (from.row !== to.row && from.column !== to.column) {
    throw new Error("Cannon must move in a straight line.");
  }

  const screens = countPiecesBetween(game.board, from, to);
  if (target === null && screens !== 0) {
    throw new Error("Cannon path must be clear when not capturing.");
  }

  if (target !== null && screens !== 1) {
    throw new Error("Cannon captures require exactly one screen.");
  }
}

function assertHorseMove(
  game: XiangqiGame,
  from: Position,
  to: Position,
  absColumn: number,
  absRow: number,
  deltaColumn: number,
  deltaRow: number
): void {
  if (!((absColumn === 1 && absRow === 2) || (absColumn === 2 && absRow === 1))) {
    throw new Error("Horse must move one point orthogonally then one diagonally.");
  }

  const leg =
    absColumn === 2
      ? { column: from.column + Math.sign(deltaColumn), row: from.row }
      : { column: from.column, row: from.row + Math.sign(deltaRow) };

  if (game.board[leg.row]?.[leg.column] !== null) {
    throw new Error("Horse leg is blocked.");
  }
}

function assertElephantMove(
  game: XiangqiGame,
  side: XiangqiSide,
  from: Position,
  to: Position,
  absColumn: number,
  absRow: number
): void {
  if (absColumn !== 2 || absRow !== 2) {
    throw new Error("Elephant must move exactly two points diagonally.");
  }

  if ((side === "red" && to.row < 5) || (side === "black" && to.row > 4)) {
    throw new Error("Elephants cannot cross the river.");
  }

  const eye = {
    column: (from.column + to.column) / 2,
    row: (from.row + to.row) / 2
  };
  if (game.board[eye.row]?.[eye.column] !== null) {
    throw new Error("Elephant eye is blocked.");
  }
}

function assertAdvisorMove(
  side: XiangqiSide,
  to: Position,
  absColumn: number,
  absRow: number
): void {
  if (absColumn !== 1 || absRow !== 1) {
    throw new Error("Advisor must move one point diagonally.");
  }

  if (!isInsidePalace(side, to)) {
    throw new Error("Advisor must stay inside the palace.");
  }
}

function assertGeneralMove(
  side: XiangqiSide,
  to: Position,
  absColumn: number,
  absRow: number
): void {
  if (absColumn + absRow !== 1) {
    throw new Error("General must move one point orthogonally.");
  }

  if (!isInsidePalace(side, to)) {
    throw new Error("General must stay inside the palace.");
  }
}

function assertSoldierMove(
  side: XiangqiSide,
  from: Position,
  absColumn: number,
  deltaRow: number
): void {
  const forward = side === "red" ? -1 : 1;
  if (deltaRow === forward && absColumn === 0) {
    return;
  }

  const crossedRiver = side === "red" ? from.row <= 4 : from.row >= 5;
  if (crossedRiver && deltaRow === 0 && absColumn === 1) {
    return;
  }

  if (deltaRow === 0 && absColumn === 1) {
    throw new Error("Soldiers can move sideways only after crossing the river.");
  }

  throw new Error("Soldier must move one point forward.");
}

function isInsidePalace(side: XiangqiSide, position: Position): boolean {
  const inColumns = position.column >= 3 && position.column <= 5;
  const inRows =
    side === "red"
      ? position.row >= 7 && position.row <= 9
      : position.row >= 0 && position.row <= 2;
  return inColumns && inRows;
}

function countPiecesBetween(
  board: readonly (readonly Cell[])[],
  from: Position,
  to: Position
): number {
  const stepColumn = Math.sign(to.column - from.column);
  const stepRow = Math.sign(to.row - from.row);
  let count = 0;
  let column = from.column + stepColumn;
  let row = from.row + stepRow;

  while (column !== to.column || row !== to.row) {
    if (board[row]?.[column] !== null) {
      count += 1;
    }
    column += stepColumn;
    row += stepRow;
  }

  return count;
}

function generalsFace(board: readonly (readonly Cell[])[]): boolean {
  const red = findGeneral(board, "red");
  const black = findGeneral(board, "black");
  if (!red || !black || red.column !== black.column) {
    return false;
  }

  const start = Math.min(red.row, black.row) + 1;
  const end = Math.max(red.row, black.row);
  for (let row = start; row < end; row += 1) {
    if (board[row]?.[red.column] !== null) {
      return false;
    }
  }

  return true;
}

function findGeneral(
  board: readonly (readonly Cell[])[],
  side: XiangqiSide
): Position | null {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let column = 0; column < BOARD_COLUMNS; column += 1) {
      const cell = board[row]?.[column];
      if (cell?.side === side && cell.type === "general") {
        return { column, row };
      }
    }
  }

  return null;
}

function assertPositionInsideBoard(position: Position): void {
  if (!isPositionInsideBoard(position)) {
    throw new Error("Move is outside the board.");
  }
}
