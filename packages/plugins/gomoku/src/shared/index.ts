export {
  BOARD_SIZE,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  WIN_LENGTH,
  createInitialGame,
  getGameStatus,
  isPositionInsideBoard,
  oppositeStone,
  placeStone
} from "./game";
export type {
  Cell,
  CreateInitialGameOptions,
  GameState,
  GomokuGame,
  GomokuMove,
  GomokuPhase,
  GomokuStatus,
  PersistedGomokuTaskGame,
  Position,
  Stone
} from "./game";
