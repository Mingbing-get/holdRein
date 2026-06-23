// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UsageStatsView } from "./usage-stats-view";

vi.mock("echarts", () => ({
  init: () => ({
    dispose: vi.fn(),
    resize: vi.fn(),
    setOption: vi.fn()
  })
}));

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

const fetchMock = vi.fn<typeof fetch>();

describe("UsageStatsView", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            bucket: "hour",
            points: [
              {
                inputToken: 10,
                modelName: "gpt-4.1",
                outputToken: 5,
                period: "2026-06-23T08:00:00.000Z",
                provider: "openai"
              }
            ],
            range: "24h"
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
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
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response);
  });

  afterEach(() => {
    cleanup();
  });

  it("loads model and task usage summaries on first render", async () => {
    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("用量统计")).toBeInTheDocument();
    expect(screen.getByText("按模型统计")).toBeInTheDocument();
    expect(screen.getByText("按任务统计")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/usage-stats/models?range=24h"
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/usage-stats/tasks?range=7d&groupBy=task"
      );
    });
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
  });

  it("renders model aggregation controls as segmented options", async () => {
    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("用量统计")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "分开输入输出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "合并输入输出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "按模型" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "总消耗" })).toBeInTheDocument();
  });
});
