import { describe, expect, it } from "vitest";

import {
  BOARD_SIZE,
  createInitialGame,
  getGameStatus,
  placeStone
} from "./game";

describe("gomoku game rules", () => {
  it("creates a 15 by 15 board with black to move first", () => {
    const game = createInitialGame();

    expect(game.board).toHaveLength(BOARD_SIZE);
    expect(game.board[0]).toHaveLength(BOARD_SIZE);
    expect(game.boardSize).toBe(BOARD_SIZE);
    expect(game.nextStone).toBe("black");
    expect(getGameStatus(game).state).toBe("playing");
  });

  it("creates a board with the requested size", () => {
    const game = createInitialGame({ boardSize: 9 });

    expect(game.board).toHaveLength(9);
    expect(game.board[0]).toHaveLength(9);
    expect(game.boardSize).toBe(9);
    expect(() => placeStone(game, { column: 9, row: 0 }, "black")).toThrow(
      "Move is outside the board."
    );
  });

  it("rejects moves outside the board", () => {
    const game = createInitialGame();

    expect(() => placeStone(game, { column: 15, row: 0 }, "black")).toThrow(
      "Move is outside the board."
    );
  });

  it("rejects occupied intersections", () => {
    const game = placeStone(createInitialGame(), { column: 7, row: 7 }, "black");

    expect(() => placeStone(game, { column: 7, row: 7 }, "white")).toThrow(
      "Intersection is already occupied."
    );
  });

  it("detects horizontal wins", () => {
    let game = createInitialGame();
    for (let column = 3; column < 8; column += 1) {
      game = placeStone(game, { column, row: 4 }, "black");
    }

    expect(getGameStatus(game)).toEqual({
      line: [
        { column: 3, row: 4 },
        { column: 4, row: 4 },
        { column: 5, row: 4 },
        { column: 6, row: 4 },
        { column: 7, row: 4 }
      ],
      state: "won",
      winner: "black"
    });
  });

  it("detects vertical wins", () => {
    let game = createInitialGame();
    for (let row = 2; row < 7; row += 1) {
      game = placeStone(game, { column: 9, row }, "white");
    }

    expect(getGameStatus(game).state).toBe("won");
    expect(getGameStatus(game).winner).toBe("white");
  });

  it("detects diagonal wins in both directions", () => {
    let descending = createInitialGame();
    let ascending = createInitialGame();

    for (let offset = 0; offset < 5; offset += 1) {
      descending = placeStone(
        descending,
        { column: 2 + offset, row: 3 + offset },
        "black"
      );
      ascending = placeStone(
        ascending,
        { column: 10 + offset, row: 8 - offset },
        "white"
      );
    }

    expect(getGameStatus(descending).winner).toBe("black");
    expect(getGameStatus(ascending).winner).toBe("white");
  });
});
