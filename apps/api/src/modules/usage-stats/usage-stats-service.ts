import { asc, eq, gte } from "drizzle-orm";

import type { AppDatabase, ModelTokenUsageHourlyRow } from "../../db";
import { modelTokenUsageHourly, tasks, workspaces } from "../../db";
import type {
  ModelUsageRange,
  ModelUsageStatsResult,
  TaskUsageGroupBy,
  TaskUsageRange,
  TaskUsageSourceRow,
  TaskUsageStatsResult,
  TaskUsageRow
} from "./usage-stats-types";

export interface UsageStatsRepositorySeed {
  modelTokenUsageHourly: ModelTokenUsageHourlyRow[];
  tasks: TaskUsageSeedTask[];
  workspaces: TaskUsageSeedWorkspace[];
}

export interface TaskUsageSeedTask {
  createdAt: string;
  id: string;
  inputToken: number;
  outputToken: number;
  title: string;
  workspaceId: string;
}

export interface TaskUsageSeedWorkspace {
  id: string;
  name: string;
}

export interface UsageStatsRepository {
  listModelTokenUsageSince: (from: string) => ModelTokenUsageHourlyRow[];
  listTasksCreatedSince: (from: string) => TaskUsageSourceRow[];
}

export interface CreateUsageStatsServiceOptions {
  now?: () => Date;
  repository: UsageStatsRepository;
}

export interface UsageStatsService {
  getModelTokenUsage: (
    options: { range: ModelUsageRange }
  ) => ModelUsageStatsResult;
  getTaskTokenUsage: (
    options: { groupBy: TaskUsageGroupBy; range: TaskUsageRange }
  ) => TaskUsageStatsResult;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createUsageStatsService({
  now = () => new Date(),
  repository
}: CreateUsageStatsServiceOptions): UsageStatsService {
  return {
    getModelTokenUsage: ({ range }) => {
      const bucket = range === "24h" ? "hour" : "day";
      const windowMs = range === "24h" ? DAY_MS : 30 * DAY_MS;
      const from = new Date(now().getTime() - windowMs).toISOString();
      const rows = repository.listModelTokenUsageSince(from);
      const pointMap = new Map<string, ModelTokenUsageHourlyRow>();

      for (const row of rows) {
        const period = bucket === "hour" ? normalizeHour(row.hour) : toUtcDay(row.hour);
        const key = `${period}\0${row.provider}\0${row.modelName}`;
        const existingPoint = pointMap.get(key);
        pointMap.set(key, {
          hour: period,
          inputToken: (existingPoint?.inputToken ?? 0) + row.inputToken,
          modelName: row.modelName,
          outputToken: (existingPoint?.outputToken ?? 0) + row.outputToken,
          provider: row.provider
        });
      }

      return {
        bucket,
        points: [...pointMap.values()]
          .map((row) => ({
            inputToken: row.inputToken,
            modelName: row.modelName,
            outputToken: row.outputToken,
            period: row.hour,
            provider: row.provider
          }))
          .sort(sortModelPoints),
        range
      };
    },
    getTaskTokenUsage: ({ groupBy, range }) => {
      const windowMs = range === "7d" ? 7 * DAY_MS : 30 * DAY_MS;
      const from = new Date(now().getTime() - windowMs).toISOString();
      const rows = repository.listTasksCreatedSince(from);

      if (groupBy === "task") {
        return {
          groupBy,
          range,
          rows: rows.map(toTaskUsageRow).sort(sortTaskUsageRows)
        };
      }

      return {
        groupBy,
        range,
        rows: groupRowsByWorkspace(rows).sort(sortTaskUsageRows)
      };
    }
  };
}

export function createInMemoryUsageStatsRepository(
  seed: UsageStatsRepositorySeed
): UsageStatsRepository {
  const modelRows = seed.modelTokenUsageHourly.map((row) => ({ ...row }));
  const tasksRows = seed.tasks.map((row) => ({ ...row }));
  const workspaceRows = seed.workspaces.map((row) => ({ ...row }));

  return {
    listModelTokenUsageSince: (from) =>
      modelRows
        .filter((row) => row.hour >= from)
        .sort((left, right) => left.hour.localeCompare(right.hour)),
    listTasksCreatedSince: (from) =>
      tasksRows
        .filter((task) => task.createdAt >= from)
        .map((task) => {
          const workspace = workspaceRows.find((row) => row.id === task.workspaceId);

          return {
            ...task,
            workspaceName: workspace?.name ?? "未知工作区"
          };
        })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  };
}

export function createSqliteUsageStatsRepository(
  database: AppDatabase
): UsageStatsRepository {
  return {
    listModelTokenUsageSince: (from) =>
      database.db
        .select()
        .from(modelTokenUsageHourly)
        .where(gte(modelTokenUsageHourly.hour, from))
        .orderBy(asc(modelTokenUsageHourly.hour))
        .all(),
    listTasksCreatedSince: (from) =>
      database.db
        .select({
          createdAt: tasks.createdAt,
          id: tasks.id,
          inputToken: tasks.inputToken,
          outputToken: tasks.outputToken,
          title: tasks.title,
          workspaceId: tasks.workspaceId,
          workspaceName: workspaces.name
        })
        .from(tasks)
        .innerJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
        .where(gte(tasks.createdAt, from))
        .orderBy(asc(tasks.createdAt))
        .all()
  };
}

function groupRowsByWorkspace(rows: TaskUsageSourceRow[]): TaskUsageRow[] {
  const rowMap = new Map<string, TaskUsageRow>();

  for (const row of rows) {
    const existingRow = rowMap.get(row.workspaceId);
    rowMap.set(row.workspaceId, {
      id: row.workspaceId,
      inputToken: (existingRow?.inputToken ?? 0) + row.inputToken,
      label: row.workspaceName,
      outputToken: (existingRow?.outputToken ?? 0) + row.outputToken,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName
    });
  }

  return [...rowMap.values()];
}

function toTaskUsageRow(row: TaskUsageSourceRow): TaskUsageRow {
  return {
    id: row.id,
    inputToken: row.inputToken,
    label: row.title,
    outputToken: row.outputToken,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName
  };
}

function normalizeHour(value: string): string {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);

  return date.toISOString();
}

function toUtcDay(value: string): string {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);

  return date.toISOString();
}

function sortModelPoints(
  left: { modelName: string; period: string; provider: string },
  right: { modelName: string; period: string; provider: string }
): number {
  return (
    left.period.localeCompare(right.period) ||
    left.provider.localeCompare(right.provider) ||
    left.modelName.localeCompare(right.modelName)
  );
}

function sortTaskUsageRows(left: TaskUsageRow, right: TaskUsageRow): number {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}
