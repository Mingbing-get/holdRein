import { Card, Empty, Segmented, Space, Switch, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import {
  fetchModelUsageStats,
  fetchTaskUsageStats
} from "./usage-stats-api";
import {
  createModelUsageChartOption,
  createTaskUsageChartOption
} from "./chart-options";
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

  const modelChartOption = useMemo(
    () =>
      modelStats
        ? createModelUsageChartOption({
            mergeModels,
            mergeTokenTypes,
            stats: modelStats
          })
        : null,
    [mergeModels, mergeTokenTypes, modelStats]
  );
  const taskChartOption = useMemo(
    () => (taskStats ? createTaskUsageChartOption(taskStats) : null),
    [taskStats]
  );

  return (
    <section
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
            <Switch
              checked={mergeTokenTypes}
              checkedChildren="合并输入输出"
              onChange={setMergeTokenTypes}
              unCheckedChildren="分开"
            />
            <Switch
              checked={mergeModels}
              checkedChildren="总消耗"
              onChange={setMergeModels}
              unCheckedChildren="按模型"
            />
          </Space>
        }
      >
        {modelError ? (
          <Empty description="模型用量加载失败" />
        ) : modelStats && modelStats.points.length > 0 && modelChartOption ? (
          <>
            <EChartsPanel ariaLabel="模型 Token 用量折线图" option={modelChartOption} />
            <UsageNames values={modelStats.points.map((point) => point.modelName)} />
          </>
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
          <>
            <EChartsPanel ariaLabel="任务 Token 用量柱状图" option={taskChartOption} />
            <UsageNames values={taskStats.rows.map((row) => row.label)} />
          </>
        ) : (
          <Empty description="暂无任务用量" />
        )}
      </Card>
    </section>
  );
}

function UsageNames({ values }: { values: string[] }) {
  return (
    <Space size={8} wrap>
      {[...new Set(values)].map((value) => (
        <Typography.Text
          key={value}
          style={{ color: "var(--app-color-text-secondary)", fontSize: 12 }}
        >
          {value}
        </Typography.Text>
      ))}
    </Space>
  );
}
