import type { HostApiRequest, HostApiResult } from "..";

export type HostApiModelUsageRange = "24h" | "30d";
export type HostApiTaskUsageGroupBy = "task" | "workspace";
export type HostApiTaskUsageRange = "7d" | "30d";

export interface HostApiModelUsageInput {
  readonly range?: HostApiModelUsageRange;
}

export interface HostApiTaskUsageInput {
  readonly groupBy?: HostApiTaskUsageGroupBy;
  readonly range?: HostApiTaskUsageRange;
}

export interface HostApiModelUsagePoint {
  readonly inputToken: number;
  readonly modelName: string;
  readonly outputToken: number;
  readonly period: string;
  readonly provider: string;
}

export interface HostApiModelUsageStats {
  readonly bucket: "day" | "hour";
  readonly points: readonly HostApiModelUsagePoint[];
  readonly range: HostApiModelUsageRange;
}

export interface HostApiTaskUsageRow {
  readonly id: string;
  readonly inputToken: number;
  readonly label: string;
  readonly outputToken: number;
  readonly workspaceId: string;
  readonly workspaceName: string;
}

export interface HostApiTaskUsageStats {
  readonly groupBy: HostApiTaskUsageGroupBy;
  readonly range: HostApiTaskUsageRange;
  readonly rows: readonly HostApiTaskUsageRow[];
}

export interface HostApiUsageStatsClient {
  readonly getModelUsage: (
    input?: HostApiModelUsageInput
  ) => Promise<HostApiResult<HostApiModelUsageStats>>;
  readonly getTaskUsage: (
    input?: HostApiTaskUsageInput
  ) => Promise<HostApiResult<HostApiTaskUsageStats>>;
}

export function createUsageStatsApi(
  request: HostApiRequest
): HostApiUsageStatsClient {
  return {
    getModelUsage(input = {}) {
      return request<HostApiModelUsageStats>({
        path: "/api/v1/usage-stats/models",
        query: { range: input.range }
      });
    },
    getTaskUsage(input = {}) {
      return request<HostApiTaskUsageStats>({
        path: "/api/v1/usage-stats/tasks",
        query: {
          range: input.range,
          groupBy: input.groupBy
        }
      });
    }
  };
}
