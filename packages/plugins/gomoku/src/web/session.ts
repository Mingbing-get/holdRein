import {
  createInitialGame,
  getGameStatus,
  oppositeStone,
  placeStone,
  type GomokuPhase,
  type GomokuGame,
  type GomokuMove,
  type GomokuStatus,
  type PersistedGomokuTaskGame,
  type Position,
  type Stone
} from "../shared";

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
  readonly boardSize?: number;
  readonly modelMove?: Position;
  readonly modelStone?: Stone;
}

export interface GomokuSessionPersistence {
  readonly loadGame: (taskId: string) => Promise<PersistedGomokuTaskGame | null>;
  readonly saveGame: (game: PersistedGomokuTaskGame) => Promise<void>;
}

export interface CreateGomokuSessionStoreOptions {
  readonly persistence?: GomokuSessionPersistence;
}

export interface GomokuSessionStore {
  readonly forcePlaceForTests: (position: Position, stone: Stone) => void;
  readonly getSnapshot: () => GomokuSnapshot;
  readonly loadTask: (taskId: string) => Promise<void>;
  readonly placeModelMove: (position: Position, taskId?: string) => Promise<string>;
  readonly playUserMove: (position: Position) => void;
  readonly resumeGame: (taskId: string) => Promise<string>;
  readonly startGame: (
    options?: StartGameOptions,
    taskId?: string
  ) => Promise<string>;
  readonly subscribe: (listener: () => void) => () => void;
}

interface PendingUserMove {
  readonly reject: (error: Error) => void;
  readonly resolve: (result: string) => void;
}

const DEFAULT_MODEL_STONE: Stone = "white";

export function createGomokuSessionStore(
  options: CreateGomokuSessionStoreOptions = {}
): GomokuSessionStore {
  let snapshot = createSnapshot(createInitialGame(), DEFAULT_MODEL_STONE, "idle");
  let pendingUserMove: PendingUserMove | null = null;
  let activeTaskId: string | undefined;
  let pendingSavedUserMove: GomokuMove | undefined;
  const listeners = new Set<() => void>();
  const persistence = options.persistence;

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateSnapshot = (next: GomokuSnapshot) => {
    snapshot = next;
    emit();
  };

  const saveSnapshot = async (
    nextSnapshot: GomokuSnapshot,
    pendingUserMoveForSave?: GomokuMove
  ) => {
    if (!persistence || !activeTaskId) {
      return;
    }

    await persistence.saveGame({
      game: nextSnapshot.game,
      modelStone: nextSnapshot.modelStone,
      ...(pendingUserMoveForSave === undefined
        ? {}
        : { pendingUserMove: pendingUserMoveForSave }),
      phase: nextSnapshot.phase,
      savedAt: new Date().toISOString(),
      taskId: activeTaskId,
      version: 1
    });
  };

  const persistSnapshot = (
    nextSnapshot: GomokuSnapshot,
    pendingUserMoveForSave?: GomokuMove
  ) => {
    void saveSnapshot(nextSnapshot, pendingUserMoveForSave).catch((error) => {
      updateSnapshot({
        ...snapshot,
        lastError:
          error instanceof Error ? error.message : "Failed to save Gomoku game."
      });
    });
  };

  const waitForUserMove = () =>
    new Promise<string>((resolve, reject) => {
      settlePending(
        new Error("A newer Gomoku tool call replaced this pending move.")
      );
      pendingUserMove = { reject, resolve };
      updateSnapshot({ ...snapshot, phase: "waiting_for_user" });
    });

  const resetToIdle = () => {
    pendingSavedUserMove = undefined;
    updateSnapshot(createSnapshot(createInitialGame(), DEFAULT_MODEL_STONE, "idle"));
  };

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
    async loadTask(taskId) {
      activeTaskId = taskId;
      const persisted = await persistence?.loadGame(taskId);
      if (!persisted) {
        resetToIdle();
        return;
      }

      pendingSavedUserMove = persisted.pendingUserMove;
      updateSnapshot(
        createSnapshot(persisted.game, persisted.modelStone, persisted.phase)
      );
    },
    placeModelMove(position, taskId) {
      if (taskId) {
        activeTaskId = taskId;
      }

      if (snapshot.status.state !== "playing") {
        throw new Error("The game is already over.");
      }

      if (snapshot.phase === "waiting_for_user") {
        throw new Error("Waiting for the user move before placing another model move.");
      }

      const game = placeStone(snapshot.game, position, snapshot.modelStone);
      pendingSavedUserMove = undefined;
      const nextSnapshot = createSnapshot(game, snapshot.modelStone, nextPhase(game));
      updateSnapshot(nextSnapshot);

      if (snapshot.status.state !== "playing") {
        persistSnapshot(nextSnapshot);
        return Promise.resolve(formatToolResult(snapshot));
      }

      const userMove = waitForUserMove();
      persistSnapshot(snapshot);
      return userMove;
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
        const move = { position, stone: snapshot.userStone };
        const nextSnapshot = createSnapshot(game, snapshot.modelStone, nextPhase(game));
        const pendingMove = pendingUserMove ? undefined : move;
        pendingSavedUserMove = pendingMove;
        updateSnapshot(nextSnapshot);
        persistSnapshot(nextSnapshot, pendingMove);
        resolveUserMove(position);
      } catch (error) {
        updateSnapshot({
          ...snapshot,
          lastError: error instanceof Error ? error.message : "Invalid move."
        });
      }
    },
    async resumeGame(taskId) {
      activeTaskId = taskId;
      const persisted = await persistence?.loadGame(taskId);
      if (persisted) {
        pendingSavedUserMove = persisted.pendingUserMove;
        updateSnapshot(
          createSnapshot(persisted.game, persisted.modelStone, persisted.phase)
        );
      } else {
        resetToIdle();
      }

      return formatToolResult(snapshot, undefined, pendingSavedUserMove);
    },
    startGame(options, taskId) {
      if (taskId) {
        activeTaskId = taskId;
      }

      const modelStone = options?.modelStone ?? DEFAULT_MODEL_STONE;
      if (modelStone === "black" && options?.modelMove === undefined) {
        throw new Error(
          "A model opening move is required when the model plays black."
        );
      }

      if (modelStone === "white" && options?.modelMove !== undefined) {
        throw new Error(
          "A model opening move can only be used when the model plays black."
        );
      }

      const initialGame = createInitialGame(
        options?.boardSize === undefined ? {} : { boardSize: options.boardSize }
      );
      const game =
        options?.modelMove === undefined
          ? initialGame
          : placeStone(initialGame, options.modelMove, modelStone);
      pendingSavedUserMove = undefined;
      const nextSnapshot = createSnapshot(game, modelStone, "waiting_for_user");
      updateSnapshot(nextSnapshot);
      const userMove = waitForUserMove();
      persistSnapshot(nextSnapshot);
      return userMove;
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
  userMove?: Position,
  pendingUserMove?: GomokuMove
): string {
  return JSON.stringify({
    boardSize: snapshot.game.boardSize,
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
        }),
    ...(pendingUserMove === undefined
      ? {}
      : {
          pendingUserMove: {
            col: pendingUserMove.position.column,
            color: pendingUserMove.stone,
            row: pendingUserMove.position.row
          }
        })
  });
}
