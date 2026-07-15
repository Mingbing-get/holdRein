import { describe, expect, it } from "vitest";

import { createInitialGame, type PersistedXiangqiTaskGame } from "../shared";
import { createXiangqiSessionStore } from "./session";

describe("xiangqi session store", () => {
  it("starts a game and resolves after the user moves", async () => {
    const store = createXiangqiSessionStore();
    const result = store.startGame({ modelSide: "black" });

    expect(store.getSnapshot().phase).toBe("waiting_for_user");

    store.playUserMove({
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });

    const output = JSON.parse(await result) as Record<string, unknown>;

    expect(output).not.toHaveProperty("board");
    expect(output).not.toHaveProperty("moves");
    expect(output.pieces).toContainEqual({
      col: 0,
      row: 5,
      side: "red",
      type: "soldier"
    });
    expect(output.userMove).toEqual({
      from: { col: 0, row: 6 },
      piece: { side: "red", type: "soldier" },
      to: { col: 0, row: 5 }
    });
  });

  it("places a model move and waits for the next user move", async () => {
    const store = createXiangqiSessionStore();
    const firstUserMove = store.startGame({ modelSide: "black" });
    store.playUserMove({
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });
    await firstUserMove;

    const secondUserMove = store.placeModelMove({
      from: { column: 0, row: 3 },
      to: { column: 0, row: 4 }
    });

    expect(store.getSnapshot().game.board[4]?.[0]).toEqual({
      side: "black",
      type: "soldier"
    });

    store.playUserMove({
      from: { column: 2, row: 6 },
      to: { column: 2, row: 5 }
    });

    const output = JSON.parse(await secondUserMove) as Record<string, unknown>;
    expect(output.moveNumber).toBe(3);
    expect(output.userMove).toEqual({
      from: { col: 2, row: 6 },
      piece: { side: "red", type: "soldier" },
      to: { col: 2, row: 5 }
    });
  });

  it("persists boards by task id without mixing tasks", async () => {
    const persistence = createMemoryPersistence();
    const firstStore = createXiangqiSessionStore({ persistence });
    const firstMove = firstStore.startGame({ modelSide: "black" }, "task-a");
    firstStore.playUserMove({
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });
    await firstMove;

    const secondStore = createXiangqiSessionStore({ persistence });
    const secondMove = secondStore.startGame({ modelSide: "black" }, "task-b");
    secondStore.playUserMove({
      from: { column: 2, row: 6 },
      to: { column: 2, row: 5 }
    });
    await secondMove;

    const restored = createXiangqiSessionStore({ persistence });
    await restored.loadTask("task-a");

    expect(restored.getSnapshot().game.board[5]?.[0]).toEqual({
      side: "red",
      type: "soldier"
    });
    expect(restored.getSnapshot().game.board[5]?.[2]).toBeNull();
    expect(persistence.records["task-a"]?.taskId).toBe("task-a");
    expect(persistence.records["task-b"]?.taskId).toBe("task-b");
  });

  it("returns a pending user move when the task is resumed", async () => {
    const persistence = createMemoryPersistence();
    const store = createXiangqiSessionStore({ persistence });
    const firstUserMove = store.startGame({ modelSide: "black" }, "task-pending");
    store.playUserMove({
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });
    await firstUserMove;
    void store.placeModelMove(
      {
        from: { column: 0, row: 3 },
        to: { column: 0, row: 4 }
      },
      "task-pending"
    );

    const restored = createXiangqiSessionStore({ persistence });
    await restored.loadTask("task-pending");
    restored.playUserMove({
      from: { column: 2, row: 6 },
      to: { column: 2, row: 5 }
    });

    const result = JSON.parse(await restored.resumeGame("task-pending")) as {
      pendingUserMove?: unknown;
    };

    expect(result.pendingUserMove).toEqual({
      from: { col: 2, row: 6 },
      piece: { side: "red", type: "soldier" },
      to: { col: 2, row: 5 }
    });
  });

  it("clears the previous board when resuming a task with no saved game", async () => {
    const persistence = createMemoryPersistence();
    const store = createXiangqiSessionStore({ persistence });
    const firstMove = store.startGame({ modelSide: "black" }, "task-with-game");
    store.playUserMove({
      from: { column: 0, row: 6 },
      to: { column: 0, row: 5 }
    });
    await firstMove;

    const output = JSON.parse(await store.resumeGame("empty-task")) as {
      moveNumber?: unknown;
      pendingUserMove?: unknown;
      phase?: unknown;
    };

    expect(output.moveNumber).toBe(0);
    expect(output.phase).toBe("idle");
    expect(output.pendingUserMove).toBeUndefined();
  });
});

function createMemoryPersistence() {
  const records: Record<string, PersistedXiangqiTaskGame> = {};

  return {
    records,
    async loadGame(taskId: string) {
      return records[taskId] ?? null;
    },
    async saveGame(record: PersistedXiangqiTaskGame) {
      records[record.taskId] = record;
    }
  };
}
