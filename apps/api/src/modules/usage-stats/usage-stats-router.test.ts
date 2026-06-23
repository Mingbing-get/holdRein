import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app";
import type { UsageStatsService } from "./usage-stats-service";

describe("usage stats routes", () => {
  it("returns model usage for a valid range", async () => {
    const usageStatsService = createUsageStatsServiceMock();
    usageStatsService.getModelTokenUsage.mockReturnValue({
      bucket: "hour",
      points: [],
      range: "24h"
    });

    const response = await request(await createApp({ usageStatsService })).get(
      "/api/v1/usage-stats/models?range=24h"
    );

    expect(response.status).toBe(200);
    expect(usageStatsService.getModelTokenUsage).toHaveBeenCalledWith({
      range: "24h"
    });
    expect(response.body).toEqual({
      code: 0,
      data: { bucket: "hour", points: [], range: "24h" },
      msg: "ok"
    });
  });

  it("rejects invalid model usage ranges", async () => {
    const response = await request(
      await createApp({ usageStatsService: createUsageStatsServiceMock() })
    ).get("/api/v1/usage-stats/models?range=year");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      data: null,
      msg: "range must be 24h or 30d"
    });
  });

  it("returns task usage for valid range and grouping values", async () => {
    const usageStatsService = createUsageStatsServiceMock();
    usageStatsService.getTaskTokenUsage.mockReturnValue({
      groupBy: "workspace",
      range: "30d",
      rows: []
    });

    const response = await request(await createApp({ usageStatsService })).get(
      "/api/v1/usage-stats/tasks?range=30d&groupBy=workspace"
    );

    expect(response.status).toBe(200);
    expect(usageStatsService.getTaskTokenUsage).toHaveBeenCalledWith({
      groupBy: "workspace",
      range: "30d"
    });
    expect(response.body).toEqual({
      code: 0,
      data: { groupBy: "workspace", range: "30d", rows: [] },
      msg: "ok"
    });
  });

  it("rejects invalid task usage query values", async () => {
    const response = await request(
      await createApp({ usageStatsService: createUsageStatsServiceMock() })
    ).get("/api/v1/usage-stats/tasks?range=24h&groupBy=model");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      data: null,
      msg: "range must be 7d or 30d"
    });
  });
});

function createUsageStatsServiceMock() {
  return {
    getModelTokenUsage: vi.fn(),
    getTaskTokenUsage: vi.fn()
  } satisfies UsageStatsService;
}
