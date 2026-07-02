import { Card, Empty, Segmented, Space, Typography } from "antd";
import type { EChartsOption } from "echarts";
import { useEffect, useMemo, useState } from "react";

import "./usage-stats-view.css";
import {
  fetchModelUsageStats,
  fetchTaskUsageStats
} from "./usage-stats-api";
import {
  createModelUsageChartOption,
  createTaskUsageChartOption
} from "./chart-options";
import type { UsageChartTheme } from "./chart-options";
import { EChartsPanel } from "./echarts-panel";
import type {
  ModelUsageRange,
  ModelUsageStats,
  TaskUsageGroupBy,
  TaskUsageRange,
  TaskUsageStats
} from "./usage-stats-types";

interface UsageStatsViewProps {
  apiBaseUrl: string;
}

type TokenTypeDisplayMode = "split" | "merged";
type ModelDisplayMode = "model" | "total";

const FALLBACK_CHART_THEME: UsageChartTheme = {
  borderSecondaryColor: "var(--app-color-border-secondary)",
  seriesColors: [
    "var(--app-color-chart-series-1)",
    "var(--app-color-chart-series-2)",
    "var(--app-color-chart-series-3)",
    "var(--app-color-chart-series-4)",
    "var(--app-color-chart-series-5)",
    "var(--app-color-chart-series-6)",
    "var(--app-color-chart-series-7)",
    "var(--app-color-chart-series-8)",
    "var(--app-color-chart-series-9)"
  ],
  textSecondaryColor: "var(--app-color-text-secondary)"
};

interface ModelLegendItem {
  color: string;
  name: string;
}

export function UsageStatsView({ apiBaseUrl }: UsageStatsViewProps) {
  const [modelRange, setModelRange] = useState<ModelUsageRange>("24h");
  const [taskRange, setTaskRange] = useState<TaskUsageRange>("7d");
  const [taskGroupBy, setTaskGroupBy] = useState<TaskUsageGroupBy>("task");
  const [mergeTokenTypes, setMergeTokenTypes] = useState(false);
  const [mergeModels, setMergeModels] = useState(false);
  const [modelStats, setModelStats] = useState<ModelUsageStats | null>(null);
  const [taskStats, setTaskStats] = useState<TaskUsageStats | null>(null);
  const [modelError, setModelError] = useState(false);
  const [taskError, setTaskError] = useState(false);
  const [chartTheme, setChartTheme] = useState<UsageChartTheme>(() =>
    readUsageChartTheme()
  );

  useEffect(() => {
    let ignore = false;
    setModelError(false);

    void fetchModelUsageStats(apiBaseUrl, modelRange)
      .then((stats) => {
        if (!ignore) {
          setModelStats(stats);
        }
      })
      .catch(() => {
        if (!ignore) {
          setModelError(true);
          setModelStats(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, modelRange]);

  useEffect(() => {
    let ignore = false;
    setTaskError(false);

    void fetchTaskUsageStats(apiBaseUrl, taskRange, taskGroupBy)
      .then((stats) => {
        if (!ignore) {
          setTaskStats(stats);
        }
      })
      .catch(() => {
        if (!ignore) {
          setTaskError(true);
          setTaskStats(null);
        }
      });

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, taskGroupBy, taskRange]);

  useEffect(() => {
    setChartTheme(readUsageChartTheme());

    if (typeof MutationObserver === "undefined") {
      return undefined;
    }

    const observer = new MutationObserver(() => {
      setChartTheme(readUsageChartTheme());
    });
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme-mode"],
      attributes: true
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const modelChartOption = useMemo(
    () =>
      modelStats
        ? createModelUsageChartOption({
            chartTheme,
            mergeModels,
            mergeTokenTypes,
            stats: modelStats
          })
        : null,
    [chartTheme, mergeModels, mergeTokenTypes, modelStats]
  );
  const modelLegendItems = useMemo(
    () =>
      modelChartOption
        ? createModelLegendItems(modelChartOption, chartTheme.seriesColors)
        : [],
    [chartTheme.seriesColors, modelChartOption]
  );
  const taskChartOption = useMemo(
    () =>
      taskStats
        ? createTaskUsageChartOption({
            chartTheme,
            stats: taskStats
          })
        : null,
    [chartTheme, taskStats]
  );

  return (
    <section
      className="usage-stats-view"
      data-testid="usage-stats-view"
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
        overflow: "auto"
      }}
    >
      <Typography.Title level={4} style={{ margin: 0 }}>
        用量统计
      </Typography.Title>
      <Card
        title="按模型统计"
        styles={{ body: { padding: 16 } }}
        extra={
          <Space size={12} wrap>
            <Segmented<ModelUsageRange>
              onChange={setModelRange}
              options={[
                { label: "近 24 小时", value: "24h" },
                { label: "近一个月", value: "30d" }
              ]}
              value={modelRange}
            />
            <Segmented<TokenTypeDisplayMode>
              onChange={(value) => {
                setMergeTokenTypes(value === "merged");
              }}
              options={[
                { label: "分开输入输出", value: "split" },
                { label: "合并输入输出", value: "merged" }
              ]}
              value={mergeTokenTypes ? "merged" : "split"}
            />
            <Segmented<ModelDisplayMode>
              onChange={(value) => {
                setMergeModels(value === "total");
              }}
              options={[
                { label: "按模型", value: "model" },
                { label: "总消耗", value: "total" }
              ]}
              value={mergeModels ? "total" : "model"}
            />
          </Space>
        }
      >
        {modelError ? (
          <Empty description="模型用量加载失败" />
        ) : modelStats && modelStats.points.length > 0 && modelChartOption ? (
          <ModelUsageChartPanel
            legendItems={modelLegendItems}
            option={modelChartOption}
          />
        ) : (
          <Empty description="暂无模型用量" />
        )}
      </Card>
      <Card
        title="按任务统计"
        styles={{ body: { padding: 16 } }}
        extra={
          <Space size={12} wrap>
            <Segmented<TaskUsageRange>
              onChange={setTaskRange}
              options={[
                { label: "近一周", value: "7d" },
                { label: "近一个月", value: "30d" }
              ]}
              value={taskRange}
            />
            <Segmented<TaskUsageGroupBy>
              onChange={setTaskGroupBy}
              options={[
                { label: "按任务", value: "task" },
                { label: "按工作区", value: "workspace" }
              ]}
              value={taskGroupBy}
            />
          </Space>
        }
      >
        {taskError ? (
          <Empty description="任务用量加载失败" />
        ) : taskStats && taskStats.rows.length > 0 && taskChartOption ? (
          <EChartsPanel ariaLabel="任务 Token 用量柱状图" option={taskChartOption} />
        ) : (
          <Empty description="暂无任务用量" />
        )}
      </Card>
    </section>
  );
}

function ModelUsageChartPanel({
  legendItems,
  option
}: {
  legendItems: ModelLegendItem[];
  option: EChartsOption;
}) {
  const [hiddenSeriesNames, setHiddenSeriesNames] = useState<Set<string>>(
    () => new Set()
  );
  const [highlightedSeriesName, setHighlightedSeriesName] = useState<string | null>(
    null
  );
  const visibleOption = useMemo(
    () => filterModelChartOption(option, hiddenSeriesNames),
    [hiddenSeriesNames, option]
  );

  useEffect(() => {
    setHiddenSeriesNames((current) => {
      const visibleNames = new Set(legendItems.map((item) => item.name));
      const next = new Set(
        [...current].filter((seriesName) => visibleNames.has(seriesName))
      );

      return next.size === current.size ? current : next;
    });
  }, [legendItems]);

  return (
    <div className="usage-stats-model-chart">
      <ul aria-label="模型图例" className="usage-stats-model-legend">
        {legendItems.map((item) => {
          const isActive = !hiddenSeriesNames.has(item.name);

          return (
            <li className="usage-stats-model-legend-item" key={item.name}>
              <button
                aria-pressed={isActive}
                className="usage-stats-model-legend-button"
                onClick={() => {
                  setHiddenSeriesNames((current) => {
                    const next = new Set(current);

                    if (next.has(item.name)) {
                      next.delete(item.name);
                    } else {
                      next.add(item.name);
                    }

                    return next;
                  });
                }}
                onMouseEnter={() => {
                  setHighlightedSeriesName(isActive ? item.name : null);
                }}
                onMouseLeave={() => {
                  setHighlightedSeriesName(null);
                }}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="usage-stats-model-legend-swatch"
                  style={{ backgroundColor: item.color }}
                />
                <span className="usage-stats-model-legend-label">
                  {item.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <EChartsPanel
        ariaLabel="模型 Token 用量折线图"
        highlightedSeriesName={highlightedSeriesName}
        option={visibleOption}
      />
    </div>
  );
}

function createModelLegendItems(
  option: EChartsOption,
  colors: string[]
): ModelLegendItem[] {
  const series = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : [];

  return series.flatMap((item, index) => {
    const name = "name" in item ? item.name : undefined;

    if (typeof name !== "string" || name.length === 0) {
      return [];
    }

    return [
      {
        color: colors[index % colors.length] ?? "var(--app-color-chart-accent)",
        name
      }
    ];
  });
}

function filterModelChartOption(
  option: EChartsOption,
  hiddenSeriesNames: Set<string>
): EChartsOption {
  const series = Array.isArray(option.series)
    ? option.series
    : option.series
      ? [option.series]
      : [];

  return {
    ...option,
    series: series.filter((item) => {
      const name = "name" in item ? item.name : undefined;

      return typeof name !== "string" || !hiddenSeriesNames.has(name);
    })
  };
}

function readUsageChartTheme(): UsageChartTheme {
  if (typeof document === "undefined") {
    return FALLBACK_CHART_THEME;
  }

  const styles = getComputedStyle(document.documentElement);
  const textSecondaryColor = styles
    .getPropertyValue("--app-color-text-secondary")
    .trim();
  const borderSecondaryColor = styles
    .getPropertyValue("--app-color-border-secondary")
    .trim();
  const seriesColors = FALLBACK_CHART_THEME.seriesColors.map((color) => {
    if (!color.startsWith("var(")) {
      return color;
    }

    const variableName = color.slice(4, -1);

    return styles.getPropertyValue(variableName).trim() || color;
  });

  return {
    borderSecondaryColor:
      borderSecondaryColor || FALLBACK_CHART_THEME.borderSecondaryColor,
    seriesColors,
    textSecondaryColor: textSecondaryColor || FALLBACK_CHART_THEME.textSecondaryColor
  };
}
