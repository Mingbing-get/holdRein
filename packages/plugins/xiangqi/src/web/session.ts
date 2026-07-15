import {
  createInitialGame,
  getGameStatus,
  movePiece,
  oppositeSide,
  type PersistedXiangqiTaskGame,
  type MovePieceOptions,
  type XiangqiGame,
  type XiangqiMove,
  type XiangqiPhase,
  type XiangqiSide,
  type XiangqiStatus
} from "../shared";

export interface XiangqiSnapshot {
  readonly game: XiangqiGame;
  readonly lastError?: string;
  readonly lastMove?: XiangqiMove;
  readonly modelSide: XiangqiSide;
  readonly phase: XiangqiPhase;
  readonly status: XiangqiStatus;
  readonly userSide: XiangqiSide;
}

export interface StartGameOptions {
  readonly modelMove?: MovePieceOptions;
  readonly modelSide?: XiangqiSide;
}

export interface XiangqiSessionPersistence {
  readonly loadGame: (taskId: string) => Promise<PersistedXiangqiTaskGame | null>;
  readonly saveGame: (game: PersistedXiangqiTaskGame) => Promise<void>;
}

export interface CreateXiangqiSessionStoreOptions {
  readonly persistence?: XiangqiSessionPersistence;
}

export interface XiangqiSessionStore {
  readonly getSnapshot: () => XiangqiSnapshot;
  readonly loadTask: (taskId: string) => Promise<void>;
  readonly placeModelMove: (
    move: MovePieceOptions,
    taskId?: string
  ) => Promise<string>;
  readonly playUserMove: (move: MovePieceOptions) => void;
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

const DEFAULT_MODEL_SIDE: XiangqiSide = "black";

export function createXiangqiSessionStore(
  options: CreateXiangqiSessionStoreOptions = {}
): XiangqiSessionStore {
  let snapshot = createSnapshot(createInitialGame(), DEFAULT_MODEL_SIDE, "idle");
  let pendingUserMove: PendingUserMove | null = null;
  let activeTaskId: string | undefined;
  let pendingSavedUserMove: XiangqiMove | undefined;
  const listeners = new Set<() => void>();
  const persistence = options.persistence;

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const updateSnapshot = (next: XiangqiSnapshot) => {
    snapshot = next;
    emit();
  };

  const saveSnapshot = async (
    nextSnapshot: XiangqiSnapshot,
    pendingUserMoveForSave?: XiangqiMove
  ) => {
    if (!persistence || !activeTaskId) {
      return;
    }

    await persistence.saveGame({
      game: nextSnapshot.game,
      modelSide: nextSnapshot.modelSide,
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
    nextSnapshot: XiangqiSnapshot,
    pendingUserMoveForSave?: XiangqiMove
  ) => {
    void saveSnapshot(nextSnapshot, pendingUserMoveForSave).catch((error) => {
      updateSnapshot({
        ...snapshot,
        lastError:
          error instanceof Error ? error.message : "Failed to save Xiangqi game."
      });
    });
  };

  const waitForUserMove = () =>
    new Promise<string>((resolve, reject) => {
      settlePending(
        new Error("A newer Xiangqi tool call replaced this pending move.")
      );
      pendingUserMove = { reject, resolve };
      updateSnapshot({ ...snapshot, phase: "waiting_for_user" });
    });

  const resetToIdle = () => {
    pendingSavedUserMove = undefined;
    updateSnapshot(createSnapshot(createInitialGame(), DEFAULT_MODEL_SIDE, "idle"));
  };

  const settlePending = (error: Error) => {
    pendingUserMove?.reject(error);
    pendingUserMove = null;
  };

  const resolveUserMove = (move: MovePieceOptions) => {
    pendingUserMove?.resolve(formatToolResult(snapshot, move));
    pendingUserMove = null;
  };

  return {
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
        createSnapshot(persisted.game, persisted.modelSide, persisted.phase)
      );
    },
    placeModelMove(move, taskId) {
      if (taskId) {
        activeTaskId = taskId;
      }

      if (snapshot.status.state !== "playing") {
        throw new Error("The game is already over.");
      }

      if (snapshot.phase === "waiting_for_user") {
        throw new Error("Waiting for the user move before placing another model move.");
      }

      const game = movePiece(snapshot.game, move);
      pendingSavedUserMove = undefined;
      const nextSnapshot = createSnapshot(game, snapshot.modelSide, nextPhase(game));
      updateSnapshot(nextSnapshot);

      if (snapshot.status.state !== "playing") {
        persistSnapshot(nextSnapshot);
        return Promise.resolve(formatToolResult(snapshot));
      }

      const userMove = waitForUserMove();
      persistSnapshot(snapshot);
      return userMove;
    },
    playUserMove(move) {
      if (snapshot.phase !== "waiting_for_user") {
        updateSnapshot({
          ...snapshot,
          lastError: "The model is not waiting for a user move."
        });
        return;
      }

      try {
        const game = movePiece(snapshot.game, move);
        const playedMove = game.moves.at(-1);
        const nextSnapshot = createSnapshot(game, snapshot.modelSide, nextPhase(game));
        const pendingMove = pendingUserMove ? undefined : playedMove;
        pendingSavedUserMove = pendingMove;
        updateSnapshot(nextSnapshot);
        persistSnapshot(nextSnapshot, pendingMove);
        resolveUserMove(move);
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
          createSnapshot(persisted.game, persisted.modelSide, persisted.phase)
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

      const modelSide = options?.modelSide ?? DEFAULT_MODEL_SIDE;
      if (modelSide === "red" && options?.modelMove === undefined) {
        throw new Error("A model opening move is required when the model plays red.");
      }

      if (modelSide === "black" && options?.modelMove !== undefined) {
        throw new Error(
          "A model opening move can only be used when the model plays red."
        );
      }

      const initialGame = createInitialGame();
      const game =
        options?.modelMove === undefined
          ? initialGame
          : movePiece(initialGame, options.modelMove);
      pendingSavedUserMove = undefined;
      const nextSnapshot = createSnapshot(game, modelSide, "waiting_for_user");
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
  game: XiangqiGame,
  modelSide: XiangqiSide,
  phase: XiangqiPhase
): XiangqiSnapshot {
  const lastMove = game.moves.at(-1);

  return {
    game,
    ...(lastMove === undefined ? {} : { lastMove }),
    modelSide,
    phase,
    status: getGameStatus(game),
    userSide: oppositeSide(modelSide)
  };
}

function nextPhase(game: XiangqiGame): XiangqiPhase {
  return getGameStatus(game).state === "playing"
    ? "waiting_for_model"
    : "finished";
}

function formatToolResult(
  snapshot: XiangqiSnapshot,
  userMove?: MovePieceOptions,
  pendingUserMove?: XiangqiMove
): string {
  const formattedUserMove =
    userMove === undefined ? undefined : formatMove(snapshot.game.moves.at(-1));

  return JSON.stringify({
    boardColumns: snapshot.game.board[0]?.length ?? 0,
    boardRows: snapshot.game.board.length,
    moveNumber: snapshot.game.moves.length,
    nextSide: snapshot.game.nextSide,
    phase: snapshot.phase,
    pieces: formatPieces(snapshot.game),
    status: snapshot.status,
    ...(formattedUserMove === undefined ? {} : { userMove: formattedUserMove }),
    ...(pendingUserMove === undefined
      ? {}
      : { pendingUserMove: formatMove(pendingUserMove) })
  });
}

function formatPieces(game: XiangqiGame) {
  return game.board.flatMap((row, rowIndex) =>
    row.flatMap((cell, columnIndex) =>
      cell
        ? [
            {
              col: columnIndex,
              row: rowIndex,
              side: cell.side,
              type: cell.type
            }
          ]
        : []
    )
  );
}

function formatMove(move?: XiangqiMove) {
  if (!move) {
    return undefined;
  }

  return {
    ...(move.captured === undefined ? {} : { captured: move.captured }),
    from: { col: move.from.column, row: move.from.row },
    piece: move.piece,
    to: { col: move.to.column, row: move.to.row }
  };
}
