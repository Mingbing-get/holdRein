export type ModelUsageRange = "24h" | "30d";
export type ModelUsageBucket = "hour" | "day";
export type TaskUsageRange = "7d" | "30d";
export type TaskUsageGroupBy = "task" | "workspace";

export interface ModelUsagePoint {
  inputToken: number;
  modelName: string;
  outputToken: number;
  period: string;
  provider: string;
}

export interface ModelUsageStatsResult {
  bucket: ModelUsageBucket;
  points: ModelUsagePoint[];
  range: ModelUsageRange;
}

export interface TaskUsageRow {
  id: string;
  inputToken: number;
  label: string;
  outputToken: number;
  workspaceId: string;
  workspaceName: string;
}

export interface TaskUsageStatsResult {
  groupBy: TaskUsageGroupBy;
  range: TaskUsageRange;
  rows: TaskUsageRow[];
}

export interface TaskUsageSourceRow {
  createdAt: string;
  id: string;
  inputToken: number;
  outputToken: number;
  title: string;
  workspaceId: string;
  workspaceName: string;
}
