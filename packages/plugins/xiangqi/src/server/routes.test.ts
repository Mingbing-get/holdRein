import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it, vi } from "vitest";

import { createInitialGame, movePiece } from "../shared";
import createRouter from "./routes";

describe("xiangqi server routes", () => {
  it("stores the latest game for a task and returns the pending user move", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "xiangqi-routes-"));
    const harness = createHarness(storageRoot);
    const taskId = "task/with:special chars";
    const game = movePiece(createInitialGame(), {
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });

    await harness.call("put", "/tasks/:taskId/game", {
      body: {
        game,
        modelSide: "black",
        pendingUserMove: game.moves[0],
        phase: "waiting_for_model"
      },
      params: { taskId }
    });

    await harness.call("get", "/tasks/:taskId/game", {
      params: { taskId }
    });

    expect(harness.sendSuccess).toHaveBeenLastCalledWith(
      harness.response,
      expect.objectContaining({
        game,
        modelSide: "black",
        pendingUserMove: game.moves[0],
        phase: "waiting_for_model",
        taskId,
        version: 1
      })
    );
  });

  it("overwrites the previous game for the same task", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "xiangqi-routes-"));
    const harness = createHarness(storageRoot);

    await harness.call("put", "/tasks/:taskId/game", {
      body: {
        game: movePiece(createInitialGame(), {
          from: { column: 0, row: 6 },
          to: { column: 0, row: 5 }
        }),
        modelSide: "black",
        phase: "waiting_for_model"
      },
      params: { taskId: "same-task" }
    });
    const latestGame = movePiece(createInitialGame(), {
      from: { column: 2, row: 6 },
      to: { column: 2, row: 5 }
    });
    await harness.call("put", "/tasks/:taskId/game", {
      body: {
        game: latestGame,
        modelSide: "black",
        phase: "waiting_for_model"
      },
      params: { taskId: "same-task" }
    });

    await harness.call("get", "/tasks/:taskId/game", {
      params: { taskId: "same-task" }
    });

    expect(harness.sendSuccess).toHaveBeenLastCalledWith(
      harness.response,
      expect.objectContaining({ game: latestGame })
    );
  });

  it("writes task games below the configured storage root", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "xiangqi-routes-"));
    const harness = createHarness(storageRoot);

    await harness.call("put", "/tasks/:taskId/game", {
      body: {
        game: createInitialGame(),
        modelSide: "black",
        phase: "waiting_for_user"
      },
      params: { taskId: "plain-task" }
    });

    const manifest = JSON.parse(
      await readFile(join(storageRoot, "tasks", "plain-task.json"), "utf8")
    ) as Record<string, unknown>;
    expect(manifest.taskId).toBe("plain-task");
  });
});

function createHarness(storageRoot: string) {
  const definitions = createDefinitions();
  const sendSuccess = vi.fn();
  const sendError = vi.fn();
  const router = createRouter(
    {
      RESPONSE_CODE_DEFINITIONS: definitions,
      sendError,
      sendSuccess
    },
    { storageRoot }
  );
  const response = {};

  return {
    definitions,
    response,
    sendError,
    sendSuccess,
    async call(method: string, path: string, request: object) {
      await findRouteHandler(router, method, path)(request, response);
    }
  };
}

function createDefinitions(): ServerPlugin.RouteContext["RESPONSE_CODE_DEFINITIONS"] {
  const definition = (httpStatus: number) => ({
    code: httpStatus,
    defaultMessage: "",
    description: "",
    httpStatus
  });
  return {
    success: definition(200),
    badRequest: definition(400),
    unauthorized: definition(401),
    forbidden: definition(403),
    notFound: definition(404),
    conflict: definition(409),
    internalError: definition(500)
  };
}

function findRouteHandler(router: unknown, method: string, path: string) {
  const layer = (router as {
    stack: {
      route?: {
        methods: Record<string, boolean>;
        path: string;
        stack: {
          handle: (request: object, response: object) => Promise<void>;
        }[];
      };
    }[];
  }).stack.find((item) => item.route?.path === path && item.route.methods[method]);

  if (!layer?.route) {
    throw new Error(`Route not found: ${method} ${path}`);
  }

  return layer.route.stack[0].handle;
}
