import { desc, eq } from "drizzle-orm";

import type { AppDatabase, TaskRow, WorkspaceRow } from "../../db";
import { tasks, workspaces } from "../../db";

export interface WorkspaceRepositorySeed {
  tasks: TaskRow[];
  workspaces: WorkspaceRow[];
}

export interface ListWorkspaceTasksInput {
  limit: number;
  workspaceId: string;
}

export interface ListWorkspaceTasksAfterInput extends ListWorkspaceTasksInput {
  afterLastContinuedAt: string;
}

export interface WorkspaceRepository {
  findWorkspaceById: (workspaceId: string) => WorkspaceRow | undefined;
  listTasksAfterLastContinuedAt: (
    input: ListWorkspaceTasksAfterInput
  ) => TaskRow[];
  listTasksByWorkspaceId: (input: ListWorkspaceTasksInput) => TaskRow[];
  listWorkspaces: () => WorkspaceRow[];
}

export function createInMemoryWorkspaceRepository(
  seed: WorkspaceRepositorySeed = { tasks: [], workspaces: [] }
): WorkspaceRepository {
  const workspaceRows = [...seed.workspaces];
  const taskRows = [...seed.tasks];

  return {
    findWorkspaceById: (workspaceId) =>
      workspaceRows.find((workspace) => workspace.id === workspaceId),
    listTasksAfterLastContinuedAt: ({
      afterLastContinuedAt,
      limit,
      workspaceId
    }) =>
      sortTasksDescending(
        taskRows.filter(
          (task) =>
            task.workspaceId === workspaceId &&
            task.lastContinuedAt !== null &&
            task.lastContinuedAt < afterLastContinuedAt
        )
      ).slice(0, limit),
    listTasksByWorkspaceId: ({ limit, workspaceId }) =>
      sortTasksDescending(
        taskRows.filter(
          (task) => task.workspaceId === workspaceId && task.lastContinuedAt !== null
        )
      ).slice(0, limit),
    listWorkspaces: () =>
      [...workspaceRows].sort((left, right) => left.name.localeCompare(right.name))
  };
}

export function createSqliteWorkspaceRepository(
  database: AppDatabase
): WorkspaceRepository {
  return {
    findWorkspaceById: (workspaceId) =>
      database.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .get(),
    listTasksAfterLastContinuedAt: ({
      afterLastContinuedAt,
      limit,
      workspaceId
    }) =>
      database.db
        .select()
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .orderBy(desc(tasks.lastContinuedAt))
        .all()
        .filter(
          (task) =>
            task.lastContinuedAt !== null &&
            task.lastContinuedAt < afterLastContinuedAt
        )
        .slice(0, limit),
    listTasksByWorkspaceId: ({ limit, workspaceId }) =>
      database.db
        .select()
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .orderBy(desc(tasks.lastContinuedAt))
        .all()
        .filter((task) => task.lastContinuedAt !== null)
        .slice(0, limit),
    listWorkspaces: () => database.db.select().from(workspaces).all()
  };
}

function sortTasksDescending(taskRows: TaskRow[]): TaskRow[] {
  return [...taskRows].sort((left, right) =>
    String(right.lastContinuedAt).localeCompare(String(left.lastContinuedAt))
  );
}
