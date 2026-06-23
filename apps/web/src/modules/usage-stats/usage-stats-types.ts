export type ModelUsageRange = "24h" | "30d";
export type TaskUsageRange = "7d" | "30d";
export type TaskUsageGroupBy = "task" | "workspace";

export interface ApiResponse<TData> {
  code: number;
  data: TData;
  msg: string;
}

export interface ModelUsagePoint {
  inputToken: number;
  modelName: string;
  outputToken: number;
  period: string;
  provider: string;
}

export interface ModelUsageStats {
  bucket: "hour" | "day";
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

export interface TaskUsageStats {
  groupBy: TaskUsageGroupBy;
  range: TaskUsageRange;
  rows: TaskUsageRow[];
}
