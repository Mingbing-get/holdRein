import type { EChartsOption, LineSeriesOption } from "echarts";

import type {
  ModelUsagePoint,
  ModelUsageStats,
  TaskUsageStats
} from "./usage-stats-types";

export interface ModelChartOptionsInput {
  chartTheme: UsageChartTheme;
  mergeModels: boolean;
  mergeTokenTypes: boolean;
  stats: ModelUsageStats;
}

export interface UsageChartTheme {
  borderSecondaryColor: string;
  seriesColors: string[];
  textSecondaryColor: string;
}

export function createModelUsageChartOption({
  chartTheme,
  mergeModels,
  mergeTokenTypes,
  stats
}: ModelChartOptionsInput): EChartsOption {
  const periods = unique(stats.points.map((point) => point.period));
  const groups = collectModelGroups(stats.points, mergeModels);
  const series: LineSeriesOption[] = groups.flatMap((group) => {
    if (mergeTokenTypes) {
      return [
        {
          data: periods.map((period) => sumModelGroup(stats.points, group, period)),
          name: group,
          smooth: true,
          type: "line"
        }
      ];
    }

    return [
      {
        data: periods.map((period) =>
          sumModelGroup(stats.points, group, period, "inputToken")
        ),
        name: `${group} 输入`,
        smooth: true,
        type: "line"
      },
      {
        data: periods.map((period) =>
          sumModelGroup(stats.points, group, period, "outputToken")
        ),
        name: `${group} 输出`,
        smooth: true,
        type: "line"
      }
    ];
  });

  const coloredSeries = series.map((item, index) => {
    const color =
      chartTheme.seriesColors[index % chartTheme.seriesColors.length] ??
      "var(--app-color-chart-accent)";

    return {
      ...item,
      itemStyle: { color },
      lineStyle: { color }
    };
  });

  return {
    color: chartTheme.seriesColors,
    grid: {
      bottom: 36,
      left: 48,
      right: 16,
      top: 16
    },
    legend: {
      show: false,
      textStyle: { color: chartTheme.textSecondaryColor },
    },
    series: coloredSeries,
    tooltip: { trigger: "axis" },
    xAxis: {
      axisLabel: { color: chartTheme.textSecondaryColor },
      data: periods.map(formatPeriodLabel),
      type: "category"
    },
    yAxis: {
      axisLabel: { color: chartTheme.textSecondaryColor },
      splitLine: { lineStyle: { color: chartTheme.borderSecondaryColor } },
      type: "value"
    }
  };
}

export interface TaskChartOptionsInput {
  chartTheme: UsageChartTheme;
  stats: TaskUsageStats;
}

export function createTaskUsageChartOption({
  chartTheme,
  stats
}: TaskChartOptionsInput): EChartsOption {
  const labels = stats.rows.map((row) => row.label);

  return {
    grid: {
      bottom: 48,
      left: 48,
      right: 16,
      top: 60
    },
    legend: {
      left: "center",
      textStyle: { color: chartTheme.textSecondaryColor },
      top: 0
    },
    series: [
      {
        data: stats.rows.map((row) => row.outputToken),
        name: "输出 Token",
        stack: "tokens",
        type: "bar"
      },
      {
        data: stats.rows.map((row) => row.inputToken),
        name: "输入 Token",
        stack: "tokens",
        type: "bar"
      }
    ],
    tooltip: { trigger: "axis" },
    xAxis: {
      axisLabel: {
        color: chartTheme.textSecondaryColor,
        formatter: truncateAxisLabel,
        interval: 0,
        rotate: labels.length > 5 ? 28 : 0
      },
      data: labels,
      type: "category"
    },
    yAxis: {
      axisLabel: { color: chartTheme.textSecondaryColor },
      splitLine: { lineStyle: { color: chartTheme.borderSecondaryColor } },
      type: "value"
    }
  };
}

function collectModelGroups(
  points: ModelUsagePoint[],
  mergeModels: boolean
): string[] {
  if (mergeModels) {
    return ["全部模型"];
  }

  return unique(
    points.map((point) => `${point.provider}/${point.modelName}`)
  );
}

function sumModelGroup(
  points: ModelUsagePoint[],
  group: string,
  period: string,
  tokenType?: "inputToken" | "outputToken"
): number {
  return points
    .filter(
      (point) =>
        point.period === period &&
        (group === "全部模型" || group === `${point.provider}/${point.modelName}`)
    )
    .reduce((total, point) => {
      if (tokenType) {
        return total + point[tokenType];
      }

      return total + point.inputToken + point.outputToken;
    }, 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function formatPeriodLabel(value: string): string {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");

  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) {
    return `${month}-${day}`;
  }

  return `${hour}:00`;
}

function truncateAxisLabel(value: string): string {
  const maxLength = 8;

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}
