import { eq } from "drizzle-orm";

import type {
  AppDatabase,
  NewScheduledAgentTaskRow,
  ScheduledAgentTaskRow
} from "../../db";
import { scheduledAgentTasks } from "../../db";

export interface ListScheduledTasksFilter {
  workspacePath?: string;
}

export interface ScheduledTasksRepository {
  createScheduledTask: (
    task: NewScheduledAgentTaskRow
  ) => ScheduledAgentTaskRow;
  deleteScheduledTaskById: (id: string) => void;
  findScheduledTaskById: (id: string) => ScheduledAgentTaskRow | undefined;
  listEnabledScheduledTasks: () => ScheduledAgentTaskRow[];
  listScheduledTasks: (
    filter?: ListScheduledTasksFilter
  ) => ScheduledAgentTaskRow[];
  updateScheduledTask: (
    id: string,
    patch: Partial<NewScheduledAgentTaskRow>
  ) => ScheduledAgentTaskRow | undefined;
  updateScheduledTaskRunMetadata: (
    id: string,
    metadata: { lastRunAt: string; nextRunAt: string; updatedAt: string }
  ) => ScheduledAgentTaskRow | undefined;
}

export function createInMemoryScheduledTasksRepository(): ScheduledTasksRepository {
  const rows: ScheduledAgentTaskRow[] = [];

  return {
    createScheduledTask: (task) => {
      const row = toScheduledTaskRow(task);
      rows.push(row);
      return row;
    },
    deleteScheduledTaskById: (id) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index >= 0) rows.splice(index, 1);
    },
    findScheduledTaskById: (id) => rows.find((row) => row.id === id),
    listEnabledScheduledTasks: () => rows.filter((row) => row.enabled),
    listScheduledTasks: (filter) =>
      filter?.workspacePath
        ? rows.filter((row) => row.workspacePath === filter.workspacePath)
        : [...rows],
    updateScheduledTask: (id, patch) => {
      const index = rows.findIndex((row) => row.id === id);
      const existing = rows[index];
      if (index === -1 || !existing) return undefined;
      const nextRow = toScheduledTaskRow({ ...existing, ...patch });
      rows[index] = nextRow;
      return nextRow;
    },
    updateScheduledTaskRunMetadata: (id, metadata) => {
      const index = rows.findIndex((row) => row.id === id);
      const existing = rows[index];
      if (index === -1 || !existing) return undefined;
      const nextRow = { ...existing, ...metadata };
      rows[index] = nextRow;
      return nextRow;
    }
  };
}

export function createSqliteScheduledTasksRepository(
  database: AppDatabase
): ScheduledTasksRepository {
  return {
    createScheduledTask: (task) => {
      const row = toScheduledTaskRow(task);
      database.db.insert(scheduledAgentTasks).values(row).run();
      return row;
    },
    deleteScheduledTaskById: (id) => {
      database.db
        .delete(scheduledAgentTasks)
        .where(eq(scheduledAgentTasks.id, id))
        .run();
    },
    findScheduledTaskById: (id) =>
      database.db
        .select()
        .from(scheduledAgentTasks)
        .where(eq(scheduledAgentTasks.id, id))
        .get(),
    listEnabledScheduledTasks: () =>
      database.db
        .select()
        .from(scheduledAgentTasks)
        .where(eq(scheduledAgentTasks.enabled, true))
        .all(),
    listScheduledTasks: (filter) => {
      const query = database.db.select().from(scheduledAgentTasks);
      if (!filter?.workspacePath) return query.all();
      return query
        .where(eq(scheduledAgentTasks.workspacePath, filter.workspacePath))
        .all();
    },
    updateScheduledTask: (id, patch) => {
      database.db
        .update(scheduledAgentTasks)
        .set(patch)
        .where(eq(scheduledAgentTasks.id, id))
        .run();
      return database.db
        .select()
        .from(scheduledAgentTasks)
        .where(eq(scheduledAgentTasks.id, id))
        .get();
    },
    updateScheduledTaskRunMetadata: (id, metadata) => {
      database.db
        .update(scheduledAgentTasks)
        .set(metadata)
        .where(eq(scheduledAgentTasks.id, id))
        .run();
      return database.db
        .select()
        .from(scheduledAgentTasks)
        .where(eq(scheduledAgentTasks.id, id))
        .get();
    }
  };
}

function toScheduledTaskRow(
  task: NewScheduledAgentTaskRow
): ScheduledAgentTaskRow {
  return {
    ...task,
    allowConcurrentRuns: task.allowConcurrentRuns ?? false,
    enabled: task.enabled ?? true,
    lastRunAt: task.lastRunAt ?? null,
    nextRunAt: task.nextRunAt ?? null,
    thinkingLevel: task.thinkingLevel ?? "medium"
  };
}
