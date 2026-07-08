import { AimOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import {
  BOARD_SIZE,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  type Position,
  type Stone
} from "../shared";
import { GomokuPanel } from "./gomoku-panel";
import {
  gomokuPlaceModelMoveToolRender,
  gomokuResumeGameToolRender,
  gomokuStartGameToolRender
} from "./gomoku-tool-render";
import { createRemoteGomokuPersistence } from "./persistence";
import { createGomokuSessionStore } from "./session";

const PANEL_ID = `${PLUGIN_ID}_gomoku`;

export function createGomokuContribution({
  request,
  subscribeAppUi
}: WebPlugin.RuntimeContext): WebPlugin.Contribution {
  const store = createGomokuSessionStore({
    persistence: createRemoteGomokuPersistence({ request })
  });
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
        Render: (props) => (
          <GomokuPanel
            store={store}
            {...(props.taskId === undefined ? {} : { taskId: props.taskId })}
          />
        )
      }
    ],
    skills: [createGomokuSkill()],
    toolRenders: [
      gomokuStartGameToolRender,
      gomokuPlaceModelMoveToolRender,
      gomokuResumeGameToolRender
    ],
    tools: [
      {
        description:
          "Start a Gomoku game in the right panel. The model can either wait for the user to move first, or start as black by providing its opening move.",
        executor: ({ arguments: args, taskId }) => {
          openPanel();
          const boardSize = readBoardSize(args.boardSize);
          const modelMove = readOptionalPosition(args);
          const modelStone = readStartModelStone(args.modelStone, modelMove);
          return store.startGame(
            {
              ...(boardSize === undefined ? {} : { boardSize }),
              ...(modelMove === undefined ? {} : { modelMove }),
              modelStone
            },
            taskId
          );
        },
        name: "gomoku_start_game",
        params: {
          additionalProperties: false,
          properties: {
            modelStone: {
              description:
                "Optional model stone color. Use white so the user moves first, or black when the model starts with row and column.",
              enum: ["black", "white"],
              type: "string"
            },
            boardSize: {
              default: BOARD_SIZE,
              description: `Optional board size from ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE}. Defaults to ${BOARD_SIZE}.`,
              maximum: MAX_BOARD_SIZE,
              minimum: MIN_BOARD_SIZE,
              type: "integer"
            },
            column: {
              description:
                "Optional zero-based opening move column when the model starts as black.",
              maximum: MAX_BOARD_SIZE - 1,
              minimum: 0,
              type: "integer"
            },
            row: {
              description:
                "Optional zero-based opening move row when the model starts as black.",
              maximum: MAX_BOARD_SIZE - 1,
              minimum: 0,
              type: "integer"
            }
          },
          type: "object"
        } as WebPlugin.BrowserRuntimeTool["params"]
      },
      {
        description:
          "Place the model's Gomoku move, wait for the user's next stone, then return the updated board state.",
        executor: ({ arguments: args, taskId }) => {
          openPanel();
          return store.placeModelMove(readPosition(args), taskId);
        },
        name: "gomoku_place_model_move",
        params: {
          additionalProperties: false,
          properties: {
            column: {
              description:
                "Zero-based board column within the current board size.",
              maximum: MAX_BOARD_SIZE - 1,
              minimum: 0,
              type: "integer"
            },
            row: {
              description: "Zero-based board row within the current board size.",
              maximum: MAX_BOARD_SIZE - 1,
              minimum: 0,
              type: "integer"
            }
          },
          required: ["row", "column"],
          type: "object"
        } as WebPlugin.BrowserRuntimeTool["params"]
      },
      {
        description:
          "Resume the current task's Gomoku game and return any user move that was saved after a previous tool call ended.",
        executor: ({ taskId }) => {
          openPanel();
          return store.resumeGame(taskId);
        },
        name: "gomoku_resume_game",
        params: {
          additionalProperties: false,
          properties: {},
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
      `- The board defaults to ${BOARD_SIZE} by ${BOARD_SIZE} intersections. gomoku_start_game can set boardSize from ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE}.`,
      "- Coordinates are zero-based: row 0 and column 0 are the top-left intersection. The maximum row and column are boardSize - 1.",
      "- Black moves first, then players alternate black and white stones.",
      "- By default the user plays black and the model plays white.",
      "- If the model starts, call gomoku_start_game with modelStone 'black' plus row and column for the model's opening move. The tool immediately renders that stone and waits for the user's white response.",
      "- A player wins immediately by making five or more connected stones horizontally, vertically, or diagonally.",
      "- A move is illegal if it is outside the board or on an occupied intersection.",
      "- If the board fills with no winner, the game is a draw.",
      "",
      "Tool flow:",
      "1. Call gomoku_resume_game first when continuing a task. If pendingUserMove is present, continue from that saved user move.",
      "2. Call gomoku_start_game to open the Gomoku panel. Omit row and column to wait for the user's first black move, or provide modelStone 'black', row, column, and optional boardSize so the model moves first.",
      "3. Choose a model move from the returned stones list. Any coordinate absent from stones is empty.",
      "4. Call gomoku_place_model_move with row and column. The tool places the model stone, waits for the user's next move, and returns the updated board.",
      "5. Repeat until the returned status is won or draw.",
      "",
      "Returned board state format:",
      "- stones contains only occupied intersections.",
      "- Each stone is { row: number, col: number, color: 'white' | 'black' }.",
      "- boardSize is the active board width and height.",
      "- Empty intersections are omitted.",
      "- pendingUserMove is returned when the user moved after a previous tool call ended; treat it as the latest user move to respond to."
    ].join("\n"),
    description: "Rules and tool flow for playing Gomoku.",
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

function readOptionalPosition(value: Record<string, unknown>): Position | undefined {
  const hasRow = value.row !== undefined;
  const hasColumn = value.column !== undefined;
  if (!hasRow && !hasColumn) {
    return undefined;
  }

  if (!hasRow || !hasColumn) {
    throw new Error("row and column must both be provided for an opening move.");
  }

  return readPosition(value);
}

function readBoardSize(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Number.isInteger(value) ||
    (value as number) < MIN_BOARD_SIZE ||
    (value as number) > MAX_BOARD_SIZE
  ) {
    throw new Error(
      `boardSize must be an integer from ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE}.`
    );
  }

  return value as number;
}

function readStartModelStone(value: unknown, modelMove?: Position): Stone {
  if (value === "black" || value === "white") {
    return value;
  }

  return modelMove === undefined ? "white" : "black";
}
