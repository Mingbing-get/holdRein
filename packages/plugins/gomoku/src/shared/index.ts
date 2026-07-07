export {
  BOARD_SIZE,
  WIN_LENGTH,
  createInitialGame,
  getGameStatus,
  isPositionInsideBoard,
  oppositeStone,
  placeStone
} from "./game";
export type {
  Cell,
  GameState,
  GomokuGame,
  GomokuMove,
  GomokuPhase,
  GomokuStatus,
  PersistedGomokuTaskGame,
  Position,
  Stone
} from "./game";
