import {
  BOARD_SIZE,
  createInitialGame,
  getGameStatus,
  oppositeStone,
  placeStone,
  type GomokuGame,
  type GomokuMove,
  type GomokuStatus,
  type Position,
  type Stone
} from "../shared";

export type GomokuPhase =
  | "finished"
  | "idle"
  | "waiting_for_model"
  | "waiting_for_user";

export interface GomokuSnapshot {
  readonly game: GomokuGame;
  readonly lastError?: string;
  readonly lastMove?: GomokuMove;
  readonly modelStone: Stone;
  readonly phase: GomokuPhase;
  readonly status: GomokuStatus;
  readonly userStone: Stone;
}

export interface StartGameOptions {
  readonly modelStone?: Stone;
}

export interface GomokuSessionStore {
  readonly forcePlaceForTests: (position: Position, stone: Stone) => void;
  readonly getSnapshot: () => GomokuSnapshot;
  readonly placeModelMove: (position: Position) => Promise<string>;
  readonly playUserMove: (position: Position) => void;
  readonly startGame: (options?: StartGameOptions) => Promise<string>;
  readonly subscribe: (listener: () => void) => () => void;
}

interface PendingUserMove {
  readonly reject: (error: Error) => void;
  readonly resolve: (result: string) => void;
}

const DEFAULT_MODEL_STONE: Stone = "white";

export function createGomokuSessionStore(): GomokuSessionStore {
  let snapshot = createSnapshot(createInitialGame(), DEFAULT_MODEL_STONE, "idle");
  let pendingUserMove: PendingUserMove | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateSnapshot = (next: GomokuSnapshot) => {
    snapshot = next;
    emit();
  };

  const waitForUserMove = () =>
    new Promise<string>((resolve, reject) => {
      settlePending(
        new Error("A newer Gomoku tool call replaced this pending move.")
      );
      pendingUserMove = { reject, resolve };
      updateSnapshot({ ...snapshot, phase: "waiting_for_user" });
    });

  const settlePending = (error: Error) => {
    pendingUserMove?.reject(error);
    pendingUserMove = null;
  };

  const resolveUserMove = (position: Position) => {
    pendingUserMove?.resolve(formatToolResult(snapshot, position));
    pendingUserMove = null;
  };

  return {
    forcePlaceForTests(position, stone) {
      const game = placeStone(snapshot.game, position, stone);
      const nextSnapshot = createSnapshot(game, snapshot.modelStone, nextPhase(game));
      updateSnapshot(
        snapshot.lastError
          ? { ...nextSnapshot, lastError: snapshot.lastError }
          : nextSnapshot
      );
    },
    getSnapshot() {
      return snapshot;
    },
    placeModelMove(position) {
      if (snapshot.status.state !== "playing") {
        throw new Error("The game is already over.");
      }

      if (snapshot.phase === "waiting_for_user") {
        throw new Error("Waiting for the user move before placing another model move.");
      }

      const game = placeStone(snapshot.game, position, snapshot.modelStone);
      updateSnapshot(createSnapshot(game, snapshot.modelStone, nextPhase(game)));

      if (snapshot.status.state !== "playing") {
        return Promise.resolve(formatToolResult(snapshot));
      }

      return waitForUserMove();
    },
    playUserMove(position) {
      if (snapshot.phase !== "waiting_for_user") {
        updateSnapshot({
          ...snapshot,
          lastError: "The model is not waiting for a user move."
        });
        return;
      }

      try {
        const game = placeStone(snapshot.game, position, snapshot.userStone);
        updateSnapshot(createSnapshot(game, snapshot.modelStone, nextPhase(game)));
        resolveUserMove(position);
      } catch (error) {
        updateSnapshot({
          ...snapshot,
          lastError: error instanceof Error ? error.message : "Invalid move."
        });
      }
    },
    startGame(options) {
      const modelStone = options?.modelStone ?? DEFAULT_MODEL_STONE;
      const game = createInitialGame();
      updateSnapshot(createSnapshot(game, modelStone, "waiting_for_user"));
      return waitForUserMove();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function createSnapshot(
  game: GomokuGame,
  modelStone: Stone,
  phase: GomokuPhase
): GomokuSnapshot {
  const lastMove = game.moves.at(-1);

  return {
    game,
    ...(lastMove === undefined ? {} : { lastMove }),
    modelStone,
    phase,
    status: getGameStatus(game),
    userStone: oppositeStone(modelStone)
  };
}

function nextPhase(game: GomokuGame): GomokuPhase {
  return getGameStatus(game).state === "playing"
    ? "waiting_for_model"
    : "finished";
}

function formatToolResult(
  snapshot: GomokuSnapshot,
  userMove?: Position
): string {
  return JSON.stringify({
    boardSize: BOARD_SIZE,
    moveNumber: snapshot.game.moves.length,
    nextStone: snapshot.game.nextStone,
    phase: snapshot.phase,
    stones: snapshot.game.moves.map((move) => ({
      col: move.position.column,
      color: move.stone,
      row: move.position.row
    })),
    status: snapshot.status,
    ...(userMove === undefined
      ? {}
      : {
          userMove: {
            col: userMove.column,
            color: snapshot.userStone,
            row: userMove.row
          }
        })
  });
}
