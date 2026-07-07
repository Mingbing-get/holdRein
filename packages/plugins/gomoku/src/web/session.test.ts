import { describe, expect, it } from "vitest";

import { createGomokuSessionStore } from "./session";

describe("gomoku session store", () => {
  it("starts a game and resolves after the user moves", async () => {
    const store = createGomokuSessionStore();
    const result = store.startGame({ modelStone: "white" });

    expect(store.getSnapshot().phase).toBe("waiting_for_user");

    store.playUserMove({ column: 7, row: 7 });

    const output = JSON.parse(await result) as Record<string, unknown>;

    expect(output).not.toHaveProperty("board");
    expect(output).not.toHaveProperty("moves");
    expect(output.stones).toEqual([
      { col: 7, color: "black", row: 7 }
    ]);
    expect(output.userMove).toEqual({ col: 7, color: "black", row: 7 });
  });

  it("places a model move and waits for the next user move", async () => {
    const store = createGomokuSessionStore();
    const firstUserMove = store.startGame({ modelStone: "white" });
    store.playUserMove({ column: 7, row: 7 });
    await firstUserMove;

    const secondUserMove = store.placeModelMove({ column: 8, row: 7 });

    expect(store.getSnapshot().game.board[7]?.[8]).toBe("white");

    store.playUserMove({ column: 7, row: 8 });

    const output = JSON.parse(await secondUserMove) as Record<string, unknown>;

    expect(output).toMatchObject({ moveNumber: 3 });
    expect(output.stones).toEqual([
      { col: 7, color: "black", row: 7 },
      { col: 8, color: "white", row: 7 },
      { col: 7, color: "black", row: 8 }
    ]);
  });

  it("tracks the latest stone for panel highlighting", async () => {
    const store = createGomokuSessionStore();
    const firstUserMove = store.startGame({ modelStone: "white" });

    store.playUserMove({ column: 7, row: 7 });
    await firstUserMove;

    expect(store.getSnapshot().lastMove).toEqual({
      position: { column: 7, row: 7 },
      stone: "black"
    });
  });

  it("moves the latest-stone highlight when the model moves", async () => {
    const store = createGomokuSessionStore();
    const firstUserMove = store.startGame({ modelStone: "white" });

    store.playUserMove({ column: 7, row: 7 });
    await firstUserMove;

    const secondUserMove = store.placeModelMove({ column: 8, row: 7 });

    expect(store.getSnapshot().lastMove).toEqual({
      position: { column: 8, row: 7 },
      stone: "white"
    });

    store.playUserMove({ column: 7, row: 8 });
    await secondUserMove;

    expect(store.getSnapshot().lastMove).toEqual({
      position: { column: 7, row: 8 },
      stone: "black"
    });
  });

  it("rejects a model move when the game is already over", async () => {
    const store = createGomokuSessionStore();
    const firstUserMove = store.startGame({ modelStone: "white" });

    store.playUserMove({ column: 0, row: 0 });
    await firstUserMove;

    for (let index = 1; index < 5; index += 1) {
      store.forcePlaceForTests({ column: index, row: 0 }, "black");
    }

    expect(() => store.placeModelMove({ column: 4, row: 4 })).toThrow(
      "The game is already over."
    );
  });
});
