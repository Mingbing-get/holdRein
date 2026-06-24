import { describe, expect, it } from "vitest";

import {
  createModelUsageChartOption,
  createTaskUsageChartOption
} from "./chart-options";

const chartTheme = {
  borderSecondaryColor: "rgba(142, 165, 196, 0.22)",
  seriesColors: ["#5470c6", "#2e9b55", "#c58b17"],
  textSecondaryColor: "rgba(239, 245, 255, 0.68)"
};

describe("usage stats chart options", () => {
  it("uses theme series colors for the model chart DOM legend", () => {
    const modelOption = createModelUsageChartOption({
      chartTheme,
      mergeModels: false,
      mergeTokenTypes: false,
      stats: {
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
      }
    });
    const taskOption = createTaskUsageChartOption({
      chartTheme,
      stats: {
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
      }
    });

    expect(modelOption).toHaveProperty("color", chartTheme.seriesColors);
    expect(taskOption).not.toHaveProperty("color");
  });

  it("uses resolved theme colors for chart text and grid lines", () => {
    const modelOption = createModelUsageChartOption({
      chartTheme,
      mergeModels: false,
      mergeTokenTypes: false,
      stats: {
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
      }
    });
    const taskOption = createTaskUsageChartOption({
      chartTheme,
      stats: {
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
      }
    });

    expect(modelOption).toMatchObject({
      legend: { textStyle: { color: chartTheme.textSecondaryColor } },
      xAxis: { axisLabel: { color: chartTheme.textSecondaryColor } },
      yAxis: {
        axisLabel: { color: chartTheme.textSecondaryColor },
        splitLine: { lineStyle: { color: chartTheme.borderSecondaryColor } }
      }
    });
    expect(taskOption).toMatchObject({
      legend: { textStyle: { color: chartTheme.textSecondaryColor } },
      xAxis: { axisLabel: { color: chartTheme.textSecondaryColor } },
      yAxis: {
        axisLabel: { color: chartTheme.textSecondaryColor },
        splitLine: { lineStyle: { color: chartTheme.borderSecondaryColor } }
      }
    });
  });

  it("truncates task axis labels longer than eight characters", () => {
    const taskOption = createTaskUsageChartOption({
      chartTheme,
      stats: {
        groupBy: "task",
        range: "7d",
        rows: [
          {
            id: "task-a",
            inputToken: 10,
            label: "1234567890",
            outputToken: 5,
            workspaceId: "workspace-a",
            workspaceName: "Alpha"
          }
        ]
      }
    });
    const xAxis = taskOption.xAxis as {
      axisLabel?: { formatter?: (value: string) => string };
    };

    expect(xAxis.axisLabel?.formatter?.("12345678")).toBe("12345678");
    expect(xAxis.axisLabel?.formatter?.("1234567890")).toBe("12345678…");
  });

  it("stacks task output tokens below input tokens", () => {
    const taskOption = createTaskUsageChartOption({
      chartTheme,
      stats: {
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
      }
    });

    expect(taskOption.series).toMatchObject([
      { data: [5], name: "输出 Token", stack: "tokens", type: "bar" },
      { data: [10], name: "输入 Token", stack: "tokens", type: "bar" }
    ]);
  });

  it("places the task legend above the bar chart", () => {
    const taskOption = createTaskUsageChartOption({
      chartTheme,
      stats: {
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
      }
    });

    expect(taskOption).toMatchObject({
      grid: { top: 60 },
      legend: {
        left: "center",
        top: 0
      }
    });
  });

  it("hides the model legend because it is rendered as responsive DOM", () => {
    const modelOption = createModelUsageChartOption({
      chartTheme,
      mergeModels: false,
      mergeTokenTypes: false,
      stats: {
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
      }
    });

    expect(modelOption).toMatchObject({
      grid: { top: 16 },
      legend: {
        show: false
      }
    });
  });
});
