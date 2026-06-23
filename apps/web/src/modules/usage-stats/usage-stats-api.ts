import type {
  ApiResponse,
  ModelUsageRange,
  ModelUsageStats,
  TaskUsageGroupBy,
  TaskUsageRange,
  TaskUsageStats
} from "./usage-stats-types";

export async function fetchModelUsageStats(
  apiBaseUrl: string,
  range: ModelUsageRange
): Promise<ModelUsageStats> {
  const response = await fetch(createModelUsageStatsUrl(apiBaseUrl, range));

  if (!response.ok) {
    throw new Error("Failed to load model usage stats");
  }

  const payload = (await response.json()) as ApiResponse<ModelUsageStats>;

  return payload.data;
}

export async function fetchTaskUsageStats(
  apiBaseUrl: string,
  range: TaskUsageRange,
  groupBy: TaskUsageGroupBy
): Promise<TaskUsageStats> {
  const response = await fetch(createTaskUsageStatsUrl(apiBaseUrl, range, groupBy));

  if (!response.ok) {
    throw new Error("Failed to load task usage stats");
  }

  const payload = (await response.json()) as ApiResponse<TaskUsageStats>;

  return payload.data;
}

export function createModelUsageStatsUrl(
  apiBaseUrl: string,
  range: ModelUsageRange
): string {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  return `${baseUrl}/api/v1/usage-stats/models?range=${range}`;
}

export function createTaskUsageStatsUrl(
  apiBaseUrl: string,
  range: TaskUsageRange,
  groupBy: TaskUsageGroupBy
): string {
  const baseUrl = apiBaseUrl.replace(/\/$/, "");

  return `${baseUrl}/api/v1/usage-stats/tasks?range=${range}&groupBy=${groupBy}`;
}
