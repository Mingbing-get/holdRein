import { Router, type Response } from "express";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import type {
  Cell,
  PersistedXiangqiTaskGame,
  Position,
  XiangqiGame,
  XiangqiMove,
  XiangqiPhase,
  XiangqiPiece,
  XiangqiSide
} from "../shared";
import { BOARD_COLUMNS, BOARD_ROWS } from "../shared";
import {
  createXiangqiTaskGameStorage,
  type XiangqiTaskGameStorage
} from "./storage";

interface RouterOptions {
  readonly createStorage?: () => XiangqiTaskGameStorage;
  readonly storageRoot?: string;
}

export default function createRouter(
  context: ServerPlugin.RouteContext,
  options: RouterOptions = {}
): Router {
  const router = Router();
  const storage =
    options.createStorage?.() ??
    createXiangqiTaskGameStorage(
      options.storageRoot === undefined ? {} : { storageRoot: options.storageRoot }
    );

  router.get("/tasks/:taskId/game", async (request, response) => {
    const taskId = readTaskId(request.params.taskId);
    if (!taskId) {
      sendBadRequest(context, response, "taskId is required");
      return;
    }

    await runOperation(context, response, async () => {
      context.sendSuccess(response, await storage.readGame(taskId));
    });
  });

  router.put("/tasks/:taskId/game", async (request, response) => {
    const taskId = readTaskId(request.params.taskId);
    const record = taskId ? readPersistedGame(taskId, request.body) : undefined;
    if (!record) {
      sendBadRequest(context, response, "A valid Xiangqi game is required");
      return;
    }

    await runOperation(context, response, async () => {
      await storage.writeGame(record);
      context.sendSuccess(response, record);
    });
  });

  router.delete("/tasks/:taskId/game", async (request, response) => {
    const taskId = readTaskId(request.params.taskId);
    if (!taskId) {
      sendBadRequest(context, response, "taskId is required");
      return;
    }

    await runOperation(context, response, async () => {
      await storage.deleteGame(taskId);
      context.sendSuccess(response, undefined);
    });
  });

  return router;
}

async function runOperation(
  context: ServerPlugin.RouteContext,
  response: Response,
  operation: () => Promise<void>
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Xiangqi storage operation failed";
    context.sendError(
      response,
      context.RESPONSE_CODE_DEFINITIONS.internalError,
      message
    );
  }
}

function sendBadRequest(
  context: ServerPlugin.RouteContext,
  response: Response,
  message: string
): void {
  context.sendError(
    response,
    context.RESPONSE_CODE_DEFINITIONS.badRequest,
    message
  );
}

function readPersistedGame(
  taskId: string,
  value: unknown
): PersistedXiangqiTaskGame | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const game = value.game;
  const modelSide = value.modelSide;
  const phase = value.phase;
  const pendingUserMove = value.pendingUserMove;

  if (!isGame(game) || !isSide(modelSide) || !isPhase(phase)) {
    return undefined;
  }

  if (pendingUserMove !== undefined && !isMove(pendingUserMove)) {
    return undefined;
  }

  return {
    game,
    modelSide,
    ...(pendingUserMove === undefined ? {} : { pendingUserMove }),
    phase,
    savedAt: new Date().toISOString(),
    taskId,
    version: 1
  };
}

function readTaskId(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGame(value: unknown): value is XiangqiGame {
  return (
    isRecord(value) &&
    isBoard(value.board) &&
    Array.isArray(value.moves) &&
    value.moves.every(isMove) &&
    isSide(value.nextSide)
  );
}

function isBoard(value: unknown): value is readonly (readonly Cell[])[] {
  return (
    Array.isArray(value) &&
    value.length === BOARD_ROWS &&
    value.every(
      (row) =>
        Array.isArray(row) &&
        row.length === BOARD_COLUMNS &&
        row.every((cell) => cell === null || isPiece(cell))
    )
  );
}

function isMove(value: unknown): value is XiangqiMove {
  return (
    isRecord(value) &&
    isPiece(value.piece) &&
    isPosition(value.from) &&
    isPosition(value.to) &&
    (value.captured === undefined || isPiece(value.captured))
  );
}

function isPosition(value: unknown): value is Position {
  return (
    isRecord(value) &&
    Number.isInteger(value.column) &&
    Number.isInteger(value.row)
  );
}

function isPhase(value: unknown): value is XiangqiPhase {
  return (
    value === "finished" ||
    value === "idle" ||
    value === "waiting_for_model" ||
    value === "waiting_for_user"
  );
}

function isPiece(value: unknown): value is XiangqiPiece {
  return isRecord(value) && isSide(value.side) && isPieceType(value.type);
}

function isSide(value: unknown): value is XiangqiSide {
  return value === "black" || value === "red";
}

function isPieceType(value: unknown): boolean {
  return (
    value === "advisor" ||
    value === "cannon" ||
    value === "chariot" ||
    value === "elephant" ||
    value === "general" ||
    value === "horse" ||
    value === "rook" ||
    value === "soldier"
  );
}
