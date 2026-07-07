import { AimOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import type { Position, Stone } from "../shared";
import { GomokuPanel } from "./gomoku-panel";
import { createGomokuSessionStore } from "./session";

const PANEL_ID = `${PLUGIN_ID}_gomoku`;

export function createGomokuContribution({
  subscribeAppUi
}: WebPlugin.RuntimeContext): WebPlugin.Contribution {
  const store = createGomokuSessionStore();
  let appUi: WebPlugin.AppUiContextValue | null = null;

  subscribeAppUi((next) => {
    appUi = next;
  });

  const openPanel = () => {
    if (!appUi) {
      return;
    }

    appUi.setRightActiveView(PANEL_ID);

    if (appUi.state.rightSidebarCollapsed) {
      appUi.toggleRightSidebar();
    }
  };

  return {
    rightPanels: [
      {
        id: "gomoku",
        icon: <AimOutlined aria-hidden="true" />,
        title: "Gomoku",
        Render: () => <GomokuPanel store={store} />
      }
    ],
    skills: [createGomokuSkill()],
    tools: [
      {
        description:
          "Start a Gomoku game in the right panel, wait for the user to place one stone, then return the move and board state.",
        executor: ({ arguments: args }) => {
          openPanel();
          return store.startGame({ modelStone: readStone(args.modelStone) });
        },
        name: "gomoku_start_game",
        params: {
          additionalProperties: false,
          properties: {
            modelStone: {
              description:
                "Optional model stone color. Use white so the user moves first.",
              enum: ["white"],
              type: "string"
            }
          },
          type: "object"
        } as WebPlugin.BrowserRuntimeTool["params"]
      },
      {
        description:
          "Place the model's Gomoku move, wait for the user's next stone, then return the updated board state.",
        executor: ({ arguments: args }) => {
          openPanel();
          return store.placeModelMove(readPosition(args));
        },
        name: "gomoku_place_model_move",
        params: {
          additionalProperties: false,
          properties: {
            column: {
              description: "Zero-based board column, from 0 to 14.",
              maximum: 14,
              minimum: 0,
              type: "integer"
            },
            row: {
              description: "Zero-based board row, from 0 to 14.",
              maximum: 14,
              minimum: 0,
              type: "integer"
            }
          },
          required: ["row", "column"],
          type: "object"
        } as WebPlugin.BrowserRuntimeTool["params"]
      }
    ]
  };
}

function createGomokuSkill(): WebPlugin.BrowserRuntimeSkill {
  return {
    content: [
      "# Gomoku",
      "",
      "Use this skill when playing Gomoku with the user through the right panel.",
      "",
      "Rules:",
      "- The board is 15 by 15 intersections.",
      "- Coordinates are zero-based: row 0-14 and column 0-14.",
      "- Black moves first, then players alternate black and white stones.",
      "- The user plays black and the model plays white.",
      "- A player wins immediately by making five or more connected stones horizontally, vertically, or diagonally.",
      "- A move is illegal if it is outside the board or on an occupied intersection.",
      "- If the board fills with no winner, the game is a draw.",
      "",
      "Tool flow:",
      "1. Call gomoku_start_game to open the Gomoku panel and wait for the user's first black move.",
      "2. Choose a white move from the returned stones list. Any coordinate absent from stones is empty.",
      "3. Call gomoku_place_model_move with row and column. The tool places the white stone, waits for the user's next black move, and returns the updated board.",
      "4. Repeat until the returned status is won or draw.",
      "",
      "Returned board state format:",
      "- stones contains only occupied intersections.",
      "- Each stone is { row: number, col: number, color: 'white' | 'black' }.",
      "- Empty intersections are omitted."
    ].join("\n"),
    description: "Rules and tool flow for playing 15x15 Gomoku.",
    name: "gomoku"
  };
}

function readPosition(value: Record<string, unknown>): Position {
  const row = value.row;
  const column = value.column;

  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    throw new Error("row and column must be integer coordinates.");
  }

  return {
    column: column as number,
    row: row as number
  };
}

function readStone(value: unknown): Stone {
  return value === "black" ? "black" : "white";
}
