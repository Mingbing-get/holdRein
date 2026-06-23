import { describe, expect, it } from "vitest";

import {
  createModelUsageChartOption,
  createTaskUsageChartOption
} from "./chart-options";

const chartTheme = {
  borderSecondaryColor: "rgba(142, 165, 196, 0.22)",
  textSecondaryColor: "rgba(239, 245, 255, 0.68)"
};

describe("usage stats chart options", () => {
  it("uses ECharts default series colors", () => {
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

    expect(modelOption).not.toHaveProperty("color");
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
});
