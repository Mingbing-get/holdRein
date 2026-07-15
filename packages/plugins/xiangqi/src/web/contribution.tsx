import { AimOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "../plugin-id";
import { BOARD_COLUMNS, BOARD_ROWS, type MovePieceOptions, type XiangqiSide } from "../shared";
import { createRemoteXiangqiPersistence } from "./persistence";
import { createXiangqiSessionStore } from "./session";
import { XiangqiPanel } from "./xiangqi-panel";
import {
  xiangqiPlaceModelMoveToolRender,
  xiangqiResumeGameToolRender,
  xiangqiStartGameToolRender
} from "./xiangqi-tool-render";

const PANEL_ID = `${PLUGIN_ID}_xiangqi`;

export function createXiangqiContribution({
  request,
  subscribeAppUi
}: WebPlugin.RuntimeContext): WebPlugin.Contribution {
  const store = createXiangqiSessionStore({
    persistence: createRemoteXiangqiPersistence({ request })
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
        id: "xiangqi",
        icon: <AimOutlined aria-hidden="true" />,
        title: "Xiangqi",
        Render: (props) => (
          <XiangqiPanel
            store={store}
            {...(props.taskId === undefined ? {} : { taskId: props.taskId })}
          />
        )
      }
    ],
    skills: [createXiangqiSkill()],
    toolRenders: [
      xiangqiStartGameToolRender,
      xiangqiPlaceModelMoveToolRender,
      xiangqiResumeGameToolRender
    ],
    tools: [
      {
        description:
          "Start a Xiangqi game in the right panel. By default the user plays red first and the model plays black.",
        executor: ({ arguments: args, taskId }) => {
          openPanel();
          const modelMove = readOptionalMove(args);
          const modelSide = readStartModelSide(args.modelSide, modelMove);
          return store.startGame(
            {
              ...(modelMove === undefined ? {} : { modelMove }),
              modelSide
            },
            taskId
          );
        },
        name: "xiangqi_start_game",
        params: createStartParams()
      },
      {
        description:
          "Place the model's Xiangqi move, wait for the user's next move, then return the updated board state.",
        executor: ({ arguments: args, taskId }) => {
          openPanel();
          return store.placeModelMove(readMove(args), taskId);
        },
        name: "xiangqi_place_model_move",
        params: createMoveParams(true)
      },
      {
        description:
          "Resume the current task's Xiangqi game and return any user move that was saved after a previous tool call ended.",
        executor: ({ taskId }) => {
          openPanel();
          return store.resumeGame(taskId);
        },
        name: "xiangqi_resume_game",
        params: {
          additionalProperties: false,
          properties: {},
          type: "object"
        } as WebPlugin.BrowserRuntimeTool["params"]
      }
    ]
  };
}

function createXiangqiSkill(): WebPlugin.BrowserRuntimeSkill {
  return {
    content: [
      "# Xiangqi",
      "",
      "Use this skill when playing Chinese chess with the user through the right panel.",
      "",
      "Rules:",
      `- The board has ${BOARD_ROWS} rows and ${BOARD_COLUMNS} columns. Coordinates are zero-based from the top-left black side.`,
      "- Red moves first, then players alternate red and black.",
      "- By default the user plays red and the model plays black.",
      "- If the model starts, call xiangqi_start_game with modelSide 'red' plus fromRow, fromColumn, toRow, and toColumn for the opening move.",
      "- Legal moves are enforced for rook/chariot, horse, elephant, advisor, general, cannon, and soldier.",
      "- Moves cannot capture your own piece, move outside the board, or leave the two generals facing each other on an open file.",
      "- The game ends when a general is captured. This lightweight referee does not enforce check, checkmate, repetition, or perpetual check.",
      "",
      "Tool flow:",
      "1. Call xiangqi_resume_game first when continuing a task. If pendingUserMove is present, continue from that saved user move.",
      "2. Call xiangqi_start_game to open the Xiangqi panel. Omit move coordinates to wait for the user's first red move.",
      "3. Choose a legal model move from the returned pieces list.",
      "4. Call xiangqi_place_model_move with fromRow, fromColumn, toRow, and toColumn. The tool places the model move, waits for the user's next move, and returns the updated board.",
      "5. Repeat until the returned status is won.",
      "",
      "Returned board state format:",
      "- pieces contains only occupied points.",
      "- Each piece is { row: number, col: number, side: 'red' | 'black', type: string }.",
      "- boardRows and boardColumns describe the active board.",
      "- Empty points are omitted.",
      "- pendingUserMove is returned when the user moved after a previous tool call ended; treat it as the latest user move to respond to."
    ].join("\n"),
    description: "Rules and tool flow for playing Xiangqi.",
    name: "xiangqi"
  };
}

function createStartParams(): WebPlugin.BrowserRuntimeTool["params"] {
  return {
    additionalProperties: false,
    properties: {
      modelSide: {
        description:
          "Optional model side. Use black so the user moves first, or red when the model starts with a move.",
        enum: ["black", "red"],
        type: "string"
      },
      ...createMoveProperties("Optional opening move")
    },
    type: "object"
  } as WebPlugin.BrowserRuntimeTool["params"];
}

function createMoveParams(required: boolean): WebPlugin.BrowserRuntimeTool["params"] {
  return {
    additionalProperties: false,
    properties: createMoveProperties("Move coordinate"),
    ...(required
      ? { required: ["fromRow", "fromColumn", "toRow", "toColumn"] }
      : {}),
    type: "object"
  } as WebPlugin.BrowserRuntimeTool["params"];
}

function createMoveProperties(descriptionPrefix: string) {
  return {
    fromColumn: {
      description: `${descriptionPrefix} source column.`,
      maximum: BOARD_COLUMNS - 1,
      minimum: 0,
      type: "integer"
    },
    fromRow: {
      description: `${descriptionPrefix} source row.`,
      maximum: BOARD_ROWS - 1,
      minimum: 0,
      type: "integer"
    },
    toColumn: {
      description: `${descriptionPrefix} target column.`,
      maximum: BOARD_COLUMNS - 1,
      minimum: 0,
      type: "integer"
    },
    toRow: {
      description: `${descriptionPrefix} target row.`,
      maximum: BOARD_ROWS - 1,
      minimum: 0,
      type: "integer"
    }
  };
}

function readMove(value: Record<string, unknown>): MovePieceOptions {
  const fromRow = value.fromRow;
  const fromColumn = value.fromColumn;
  const toRow = value.toRow;
  const toColumn = value.toColumn;

  if (
    !Number.isInteger(fromRow) ||
    !Number.isInteger(fromColumn) ||
    !Number.isInteger(toRow) ||
    !Number.isInteger(toColumn)
  ) {
    throw new Error("fromRow, fromColumn, toRow, and toColumn must be integers.");
  }

  return {
    from: { column: fromColumn as number, row: fromRow as number },
    to: { column: toColumn as number, row: toRow as number }
  };
}

function readOptionalMove(
  value: Record<string, unknown>
): MovePieceOptions | undefined {
  const keys = ["fromRow", "fromColumn", "toRow", "toColumn"] as const;
  const provided = keys.filter((key) => value[key] !== undefined);
  if (provided.length === 0) {
    return undefined;
  }

  if (provided.length !== keys.length) {
    throw new Error("All opening move coordinates must be provided together.");
  }

  return readMove(value);
}

function readStartModelSide(
  value: unknown,
  modelMove?: MovePieceOptions
): XiangqiSide {
  if (value === "black" || value === "red") {
    return value;
  }

  return modelMove === undefined ? "black" : "red";
}
