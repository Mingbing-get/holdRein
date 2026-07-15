import { describe, expect, it } from "vitest";

import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  createInitialGame,
  getGameStatus,
  movePiece
} from "./game";

describe("xiangqi game rules", () => {
  it("creates the standard 10 by 9 board with red to move first", () => {
    const game = createInitialGame();

    expect(game.board).toHaveLength(BOARD_ROWS);
    expect(game.board[0]).toHaveLength(BOARD_COLUMNS);
    expect(game.nextSide).toBe("red");
    expect(game.board[9]?.[4]).toEqual({ side: "red", type: "general" });
    expect(game.board[0]?.[4]).toEqual({ side: "black", type: "general" });
    expect(getGameStatus(game).state).toBe("playing");
  });

  it("moves a rook in a straight line when the path is clear", () => {
    const game = createInitialGame();
    const moved = movePiece(game, {
      from: { column: 0, row: 9 },
      to: { column: 0, row: 8 }
    });

    expect(moved.board[9]?.[0]).toBeNull();
    expect(moved.board[8]?.[0]).toEqual({ side: "red", type: "rook" });
    expect(moved.nextSide).toBe("black");
  });

  it("rejects blocked rook moves", () => {
    const game = createInitialGame();

    expect(() =>
      movePiece(game, {
        from: { column: 0, row: 9 },
        to: { column: 0, row: 3 }
      })
    ).toThrow("Rook path must be clear.");
  });

  it("requires a cannon screen when capturing", () => {
    const game = createInitialGame();

    expect(() =>
      movePiece(game, {
        from: { column: 1, row: 7 },
        to: { column: 1, row: 2 }
      })
    ).toThrow("Cannon captures require exactly one screen.");

    const captured = movePiece(game, {
      from: { column: 1, row: 7 },
      to: { column: 1, row: 0 }
    });
    expect(captured.board[0]?.[1]).toEqual({ side: "red", type: "cannon" });
  });

  it("blocks horse moves when the horse leg is occupied", () => {
    const game = createInitialGame();

    expect(() =>
      movePiece(game, {
        from: { column: 1, row: 9 },
        to: { column: 3, row: 8 }
      })
    ).toThrow("Horse leg is blocked.");
  });

  it("keeps elephants on their own side of the river", () => {
    let game = createInitialGame();
    game = movePiece(game, {
      from: { column: 2, row: 9 },
      to: { column: 4, row: 7 }
    });
    game = movePiece(game, {
      from: { column: 2, row: 0 },
      to: { column: 4, row: 2 }
    });
    game = movePiece(game, {
      from: { column: 4, row: 7 },
      to: { column: 6, row: 5 }
    });
    game = movePiece(game, {
      from: { column: 4, row: 2 },
      to: { column: 6, row: 4 }
    });

    expect(() =>
      movePiece(game, {
        from: { column: 6, row: 5 },
        to: { column: 4, row: 3 }
      })
    ).toThrow("Elephants cannot cross the river.");
  });

  it("keeps advisors and generals inside the palace", () => {
    const game = createInitialGame();

    expect(() =>
      movePiece(game, {
        from: { column: 3, row: 9 },
        to: { column: 3, row: 8 }
      })
    ).toThrow("Advisor must move one point diagonally.");

    expect(() =>
      movePiece(game, {
        from: { column: 4, row: 9 },
        to: { column: 4, row: 7 }
      })
    ).toThrow("General must move one point orthogonally.");
  });

  it("lets soldiers move sideways only after crossing the river", () => {
    const game = createInitialGame();

    expect(() =>
      movePiece(game, {
        from: { column: 0, row: 6 },
        to: { column: 1, row: 6 }
      })
    ).toThrow("Soldiers can move sideways only after crossing the river.");
  });

  it("prevents the two generals from facing each other", () => {
    const game = createInitialGame({
      pieces: [
        { piece: { side: "red", type: "general" }, position: { column: 4, row: 9 } },
        { piece: { side: "black", type: "general" }, position: { column: 4, row: 0 } },
        { piece: { side: "red", type: "soldier" }, position: { column: 4, row: 4 } }
      ]
    });

    expect(() =>
      movePiece(game, {
        from: { column: 4, row: 4 },
        to: { column: 3, row: 4 }
      })
    ).toThrow("Generals cannot face each other.");
  });

  it("ends the game when a general is captured", () => {
    const game = createInitialGame({
      pieces: [
        { piece: { side: "red", type: "general" }, position: { column: 4, row: 9 } },
        { piece: { side: "black", type: "general" }, position: { column: 3, row: 0 } },
        { piece: { side: "red", type: "rook" }, position: { column: 0, row: 0 } }
      ]
    });

    const finished = movePiece(game, {
      from: { column: 0, row: 0 },
      to: { column: 3, row: 0 }
    });

    expect(getGameStatus(finished)).toEqual({
      state: "won",
      winner: "red"
    });
  });
});
