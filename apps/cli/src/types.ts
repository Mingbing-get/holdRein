import type { InstallPluginPackageOptions } from "@hold-rein/plugin-server";

export interface CliOptions {
  readonly currentWorkingDirectory?: string;
  readonly installPluginPackage?: (
    options: InstallPluginPackageOptions
  ) => Promise<string>;
  readonly packageVersion: string;
  readonly services?: CliServices;
  readonly startRunServer?: StartRunServer;
  readonly write: (value: string) => void;
}

export interface CliServices {
  readonly scheduledTasks?: ScheduledTasksService;
  readonly usageStats?: UsageStatsService;
  readonly workspaces?: WorkspacesService;
}

export interface CliResult {
  readonly exitCode: number;
}

export interface RunServerOptions {
  readonly devPluginPaths?: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly write: (value: string) => void;
}

export interface RunServerResult {
  readonly host: string;
  readonly port: number;
  readonly url: string;
}

export type StartRunServer = (
  options: RunServerOptions
) => Promise<RunServerResult>;

export interface WorkspacesService {
  deleteWorkspace: (workspaceId: string) => Promise<{
    readonly status: "deleted" | "has_running_tasks" | "not_found";
    readonly workspaceId: string;
  }>;
  getWorkspaceSetting: (workspaceId: string) => Promise<unknown>;
  listRecentWorkspaceTasks: () => {
    readonly workspaces: readonly {
      readonly hasMore: boolean;
      readonly id: string;
      readonly name: string;
      readonly path: string;
      readonly tasks: readonly unknown[];
    }[];
  };
  listWorkspaceTasksAfter: (options: {
    readonly afterLastContinuedAt: string;
    readonly limit: number;
    readonly workspaceId: string;
  }) => unknown;
  updateWorkspaceSetting: (workspaceId: string, input: unknown) => Promise<unknown>;
}

export interface ScheduledTasksService {
  createScheduledTask: (input: ScheduledAgentTaskInput) => ScheduledTaskRow;
  deleteScheduledTask: (id: string) => boolean;
  disableScheduledTask: (id: string) => ScheduledTaskRow | undefined;
  enableScheduledTask: (id: string) => ScheduledTaskRow | undefined;
  findScheduledTask: (id: string) => ScheduledTaskRow | undefined;
  listScheduledTasks: (
    filter?: { readonly workspacePath: string }
  ) => readonly ScheduledTaskRow[];
  updateScheduledTask: (
    id: string,
    input: Partial<ScheduledAgentTaskInput>
  ) => ScheduledTaskRow | undefined;
}

export interface ScheduledAgentTaskInput {
  readonly allowConcurrentRuns: boolean;
  readonly cronExpression: string;
  readonly enabled?: boolean;
  readonly modelId: string;
  readonly name: string;
  readonly prompt: string;
  readonly provider: string;
  readonly thinkingLevel: string;
  readonly timezone: string;
  readonly workspacePath: string;
}

export interface ScheduledTaskRow extends ScheduledAgentTaskInput {
  readonly createdAt: string;
  readonly enabled: boolean;
  readonly id: string;
  readonly lastRunAt: string | null;
  readonly nextRunAt: string | null;
  readonly updatedAt: string;
}

export interface UsageStatsService {
  getModelTokenUsage: (options: { readonly range: "24h" | "30d" }) => {
    readonly bucket: "hour" | "day";
    readonly points: readonly {
      readonly inputToken: number;
      readonly modelName: string;
      readonly outputToken: number;
      readonly period: string;
      readonly provider: string;
    }[];
    readonly range: "24h" | "30d";
  };
  getTaskTokenUsage: (options: {
    readonly groupBy: "task" | "workspace";
    readonly range: "7d" | "30d";
  }) => {
    readonly groupBy: "task" | "workspace";
    readonly range: "7d" | "30d";
    readonly rows: readonly {
      readonly id: string;
      readonly inputToken: number;
      readonly label: string;
      readonly outputToken: number;
      readonly workspaceId: string;
      readonly workspaceName: string;
    }[];
  };
}
