import { describe, expect, it, vi } from "vitest";

import {
  createModelUsageStatsUrl,
  createTaskUsageStatsUrl,
  fetchModelUsageStats,
  fetchTaskUsageStats
} from "./usage-stats-api";

describe("usage stats API", () => {
  it("builds model and task usage URLs", () => {
    expect(createModelUsageStatsUrl("http://localhost:4000/", "30d")).toBe(
      "http://localhost:4000/api/v1/usage-stats/models?range=30d"
    );
    expect(
      createTaskUsageStatsUrl("http://localhost:4000/", "7d", "workspace")
    ).toBe(
      "http://localhost:4000/api/v1/usage-stats/tasks?range=7d&groupBy=workspace"
    );
  });

  it("fetches model and task usage payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { bucket: "hour", points: [], range: "24h" },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { groupBy: "task", range: "7d", rows: [] },
          msg: "ok"
        }),
        ok: true
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchModelUsageStats("http://localhost:4000", "24h")).resolves.toEqual({
      bucket: "hour",
      points: [],
      range: "24h"
    });
    await expect(
      fetchTaskUsageStats("http://localhost:4000", "7d", "task")
    ).resolves.toEqual({
      groupBy: "task",
      range: "7d",
      rows: []
    });
  });
});
