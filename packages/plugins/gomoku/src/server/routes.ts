import { Router, type Response } from "express";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import type {
  GomokuGame,
  GomokuMove,
  GomokuPhase,
  PersistedGomokuTaskGame,
  Stone
} from "../shared";
import {
  createGomokuTaskGameStorage,
  type GomokuTaskGameStorage
} from "./storage";

interface RouterOptions {
  readonly createStorage?: () => GomokuTaskGameStorage;
  readonly storageRoot?: string;
}

export default function createRouter(
  context: ServerPlugin.RouteContext,
  options: RouterOptions = {}
): Router {
  const router = Router();
  const storage =
    options.createStorage?.() ??
    createGomokuTaskGameStorage(
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
      sendBadRequest(context, response, "A valid Gomoku game is required");
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
      error instanceof Error ? error.message : "Gomoku storage operation failed";
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
): PersistedGomokuTaskGame | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const game = value.game;
  const modelStone = value.modelStone;
  const phase = value.phase;
  const pendingUserMove = value.pendingUserMove;

  if (!isGame(game) || !isStone(modelStone) || !isPhase(phase)) {
    return undefined;
  }

  if (pendingUserMove !== undefined && !isMove(pendingUserMove)) {
    return undefined;
  }

  return {
    game,
    modelStone,
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

function isGame(value: unknown): value is GomokuGame {
  return (
    isRecord(value) &&
    Array.isArray(value.board) &&
    Array.isArray(value.moves) &&
    isStone(value.nextStone)
  );
}

function isMove(value: unknown): value is GomokuMove {
  return (
    isRecord(value) &&
    isStone(value.stone) &&
    isRecord(value.position) &&
    Number.isInteger(value.position.column) &&
    Number.isInteger(value.position.row)
  );
}

function isPhase(value: unknown): value is GomokuPhase {
  return (
    value === "finished" ||
    value === "idle" ||
    value === "waiting_for_model" ||
    value === "waiting_for_user"
  );
}

function isStone(value: unknown): value is Stone {
  return value === "black" || value === "white";
}
