import { describe, expect, it } from "vitest";

import {
  createInMemoryUsageStatsRepository,
  createUsageStatsService
} from "./usage-stats-service";

const NOW = new Date("2026-06-23T12:30:00.000Z");

describe("usage stats service", () => {
  it("returns hourly model token usage for the last 24 hours", () => {
    const service = createUsageStatsService({
      now: () => NOW,
      repository: createInMemoryUsageStatsRepository({
        modelTokenUsageHourly: [
          modelUsage("2026-06-22T11:00:00.000Z", "openai", "gpt-4.1", 99, 1),
          modelUsage("2026-06-23T08:00:00.000Z", "openai", "gpt-4.1", 10, 5),
          modelUsage("2026-06-23T08:00:00.000Z", "anthropic", "claude", 8, 12),
          modelUsage("2026-06-23T09:00:00.000Z", "openai", "gpt-4.1", 4, 7)
        ],
        tasks: [],
        workspaces: []
      })
    });

    expect(service.getModelTokenUsage({ range: "24h" })).toEqual({
      bucket: "hour",
      points: [
        {
          inputToken: 8,
          modelName: "claude",
          outputToken: 12,
          period: "2026-06-23T08:00:00.000Z",
          provider: "anthropic"
        },
        {
          inputToken: 10,
          modelName: "gpt-4.1",
          outputToken: 5,
          period: "2026-06-23T08:00:00.000Z",
          provider: "openai"
        },
        {
          inputToken: 4,
          modelName: "gpt-4.1",
          outputToken: 7,
          period: "2026-06-23T09:00:00.000Z",
          provider: "openai"
        }
      ],
      range: "24h"
    });
  });

  it("returns daily model token usage for the last month", () => {
    const service = createUsageStatsService({
      now: () => NOW,
      repository: createInMemoryUsageStatsRepository({
        modelTokenUsageHourly: [
          modelUsage("2026-05-20T09:00:00.000Z", "openai", "gpt-4.1", 99, 1),
          modelUsage("2026-06-01T08:00:00.000Z", "openai", "gpt-4.1", 10, 5),
          modelUsage("2026-06-01T19:00:00.000Z", "openai", "gpt-4.1", 4, 7),
          modelUsage("2026-06-02T09:00:00.000Z", "anthropic", "claude", 2, 3)
        ],
        tasks: [],
        workspaces: []
      })
    });

    expect(service.getModelTokenUsage({ range: "30d" })).toEqual({
      bucket: "day",
      points: [
        {
          inputToken: 14,
          modelName: "gpt-4.1",
          outputToken: 12,
          period: "2026-06-01T00:00:00.000Z",
          provider: "openai"
        },
        {
          inputToken: 2,
          modelName: "claude",
          outputToken: 3,
          period: "2026-06-02T00:00:00.000Z",
          provider: "anthropic"
        }
      ],
      range: "30d"
    });
  });

  it("returns token usage for tasks created in the selected window", () => {
    const service = createUsageStatsService({
      now: () => NOW,
      repository: createInMemoryUsageStatsRepository({
        modelTokenUsageHourly: [],
        tasks: [
          task("task-old", "Old task", "workspace-a", "2026-06-01T00:00:00.000Z", 90, 10),
          task("task-a", "Task A", "workspace-a", "2026-06-20T00:00:00.000Z", 10, 5),
          task("task-b", "Task B", "workspace-b", "2026-06-21T00:00:00.000Z", 2, 8)
        ],
        workspaces: [
          workspace("workspace-a", "Alpha"),
          workspace("workspace-b", "Beta")
        ]
      })
    });

    expect(service.getTaskTokenUsage({ groupBy: "task", range: "7d" })).toEqual({
      groupBy: "task",
      range: "7d",
      rows: [
        {
          id: "task-a",
          inputToken: 10,
          label: "Task A",
          outputToken: 5,
          workspaceId: "workspace-a",
          workspaceName: "Alpha"
        },
        {
          id: "task-b",
          inputToken: 2,
          label: "Task B",
          outputToken: 8,
          workspaceId: "workspace-b",
          workspaceName: "Beta"
        }
      ]
    });
  });

  it("groups selected task usage by workspace", () => {
    const service = createUsageStatsService({
      now: () => NOW,
      repository: createInMemoryUsageStatsRepository({
        modelTokenUsageHourly: [],
        tasks: [
          task("task-a", "Task A", "workspace-a", "2026-06-20T00:00:00.000Z", 10, 5),
          task("task-b", "Task B", "workspace-a", "2026-06-21T00:00:00.000Z", 2, 8),
          task("task-c", "Task C", "workspace-b", "2026-06-22T00:00:00.000Z", 3, 4)
        ],
        workspaces: [
          workspace("workspace-a", "Alpha"),
          workspace("workspace-b", "Beta")
        ]
      })
    });

    expect(service.getTaskTokenUsage({ groupBy: "workspace", range: "30d" })).toEqual({
      groupBy: "workspace",
      range: "30d",
      rows: [
        {
          id: "workspace-a",
          inputToken: 12,
          label: "Alpha",
          outputToken: 13,
          workspaceId: "workspace-a",
          workspaceName: "Alpha"
        },
        {
          id: "workspace-b",
          inputToken: 3,
          label: "Beta",
          outputToken: 4,
          workspaceId: "workspace-b",
          workspaceName: "Beta"
        }
      ]
    });
  });
});

function modelUsage(
  hour: string,
  provider: string,
  modelName: string,
  inputToken: number,
  outputToken: number
) {
  return { hour, inputToken, modelName, outputToken, provider };
}

function task(
  id: string,
  title: string,
  workspaceId: string,
  createdAt: string,
  inputToken: number,
  outputToken: number
) {
  return {
    createdAt,
    id,
    inputToken,
    outputToken,
    title,
    workspaceId
  };
}

function workspace(id: string, name: string) {
  return { id, name };
}
