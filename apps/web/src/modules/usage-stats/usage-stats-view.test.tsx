// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UsageStatsView } from "./usage-stats-view";

const echartsMock = vi.hoisted(() => ({
  charts: [] as {
    dispatchAction: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setOption: ReturnType<typeof vi.fn>;
  }[]
}));

vi.mock("echarts", () => ({
  init: () => {
    const chart = {
      dispatchAction: vi.fn(),
      dispose: vi.fn(),
      resize: vi.fn(),
      setOption: vi.fn()
    };
    echartsMock.charts.push(chart);

    return chart;
  }
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
    echartsMock.charts.length = 0;
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
    expect(
      screen.getByRole("img", { name: "模型 Token 用量折线图" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "任务 Token 用量柱状图" })
    ).toBeInTheDocument();
  });

  it("renders model aggregation controls as segmented options", async () => {
    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    expect(await screen.findByText("用量统计")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "分开输入输出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "合并输入输出" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "按模型" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "总消耗" })).toBeInTheDocument();
  });

  it("renders model series names in a responsive DOM legend", async () => {
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
              },
              {
                inputToken: 12,
                modelName: "claude-sonnet-4",
                outputToken: 6,
                period: "2026-06-23T08:00:00.000Z",
                provider: "anthropic"
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

    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    const legend = await screen.findByRole("list", { name: "模型图例" });

    expect(legend).toHaveTextContent("anthropic/claude-sonnet-4 输入");
    expect(legend).toHaveTextContent("anthropic/claude-sonnet-4 输出");
    expect(legend).toHaveTextContent("openai/gpt-4.1 输入");
    expect(legend).toHaveTextContent("openai/gpt-4.1 输出");
  });

  it("highlights the matching model series while hovering a legend item", async () => {
    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    const legendButton = await screen.findByRole("button", {
      name: "openai/gpt-4.1 输入"
    });

    fireEvent.mouseEnter(legendButton);

    expect(echartsMock.charts[0]?.dispatchAction).toHaveBeenCalledWith({
      seriesName: "openai/gpt-4.1 输入",
      type: "highlight"
    });

    fireEvent.mouseLeave(legendButton);

    expect(echartsMock.charts[0]?.dispatchAction).toHaveBeenCalledWith({
      seriesName: "openai/gpt-4.1 输入",
      type: "downplay"
    });
  });

  it("toggles a model series when clicking a legend item", async () => {
    render(<UsageStatsView apiBaseUrl="http://localhost:4000" />);

    const legendButton = await screen.findByRole("button", {
      name: "openai/gpt-4.1 输入"
    });

    expect(legendButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(legendButton);

    expect(legendButton).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => {
      expect(echartsMock.charts[0]?.setOption).toHaveBeenLastCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({
              name: "openai/gpt-4.1 输出"
            })
          ]
        }),
        { replaceMerge: ["series"] }
      );
    });
  });
});
