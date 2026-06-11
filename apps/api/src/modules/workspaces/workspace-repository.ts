import { desc, eq } from "drizzle-orm";

import type {
  AppDatabase,
  NewTaskRow,
  NewWorkspaceRow,
  TaskRow,
  WorkspaceRow
} from "../../db";
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
  createTask: (task: NewTaskRow) => TaskRow;
  createWorkspace: (workspace: NewWorkspaceRow) => WorkspaceRow;
  findTaskById: (taskId: string) => TaskRow | undefined;
  findWorkspaceById: (workspaceId: string) => WorkspaceRow | undefined;
  findWorkspaceByPath: (workspacePath: string) => WorkspaceRow | undefined;
  listTasksAfterLastContinuedAt: (
    input: ListWorkspaceTasksAfterInput
  ) => TaskRow[];
  listTasksByWorkspaceId: (input: ListWorkspaceTasksInput) => TaskRow[];
  listWorkspaces: () => WorkspaceRow[];
  updateTaskTitle: (taskId: string, title: string, updatedAt: string) => TaskRow | undefined;
  updateTaskContinuedAt: (taskId: string, continuedAt: string) => TaskRow | undefined;
  updateTaskModel: (
    taskId: string,
    model: Pick<
      TaskRow,
      "lastModelId" | "lastModelName" | "lastModelProvider" | "lastModelProviderSource"
    >,
    updatedAt: string
  ) => TaskRow | undefined;
  updateTaskSession: (
    taskId: string,
    session: { createdAt: string; id: string; path: string }
  ) => TaskRow | undefined;
  updateTaskStatus: (
    taskId: string,
    status: TaskRow["status"],
    updatedAt: string
  ) => TaskRow | undefined;
}

export function createInMemoryWorkspaceRepository(
  seed: WorkspaceRepositorySeed = { tasks: [], workspaces: [] }
): WorkspaceRepository {
  const workspaceRows = [...seed.workspaces];
  const taskRows = [...seed.tasks];

  return {
    createTask: (task) => {
      const row = toTaskRow(task);
      taskRows.push(row);

      return row;
    },
    createWorkspace: (workspace) => {
      workspaceRows.push(workspace);

      return workspace;
    },
    findTaskById: (taskId) => taskRows.find((task) => task.id === taskId),
    findWorkspaceById: (workspaceId) =>
      workspaceRows.find((workspace) => workspace.id === workspaceId),
    findWorkspaceByPath: (workspacePath) =>
      workspaceRows.find((workspace) => workspace.path === workspacePath),
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
      [...workspaceRows].sort((left, right) => left.name.localeCompare(right.name)),
    updateTaskTitle: (taskId, title, updatedAt) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows.find((task) => task.id === taskId);

      if (taskIndex === -1 || !existingTask) {
        return undefined;
      }

      const nextTask: TaskRow = { ...existingTask, title, updatedAt };
      taskRows[taskIndex] = nextTask;

      return nextTask;
    },
    updateTaskContinuedAt: (taskId, continuedAt) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = {
        ...existingTask,
        lastContinuedAt: continuedAt,
        updatedAt: continuedAt
      };
      taskRows[taskIndex] = nextTask;
      return nextTask;
    },
    updateTaskModel: (taskId, model, updatedAt) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = { ...existingTask, ...model, updatedAt };
      taskRows[taskIndex] = nextTask;
      return nextTask;
    },
    updateTaskSession: (taskId, session) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = {
        ...existingTask,
        sessionCreatedAt: session.createdAt,
        sessionId: session.id,
        sessionPath: session.path
      };
      taskRows[taskIndex] = nextTask;
      return nextTask;
    },
    updateTaskStatus: (taskId, status, updatedAt) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = { ...existingTask, status, updatedAt };
      taskRows[taskIndex] = nextTask;
      return nextTask;
    }
  };
}

export function createSqliteWorkspaceRepository(
  database: AppDatabase
): WorkspaceRepository {
  return {
    createTask: (task) => {
      const row = toTaskRow(task);
      database.db.insert(tasks).values(row).run();

      return row;
    },
    createWorkspace: (workspace) => {
      database.db.insert(workspaces).values(workspace).run();

      return workspace;
    },
    findTaskById: (taskId) =>
      database.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get(),
    findWorkspaceById: (workspaceId) =>
      database.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .get(),
    findWorkspaceByPath: (workspacePath) =>
      database.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.path, workspacePath))
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
    listWorkspaces: () => database.db.select().from(workspaces).all(),
    updateTaskTitle: (taskId, title, updatedAt) => {
      database.db
        .update(tasks)
        .set({ title, updatedAt })
        .where(eq(tasks.id, taskId))
        .run();

      return database.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get();
    },
    updateTaskContinuedAt: (taskId, continuedAt) => {
      database.db
        .update(tasks)
        .set({ lastContinuedAt: continuedAt, updatedAt: continuedAt })
        .where(eq(tasks.id, taskId))
        .run();
      return database.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    },
    updateTaskModel: (taskId, model, updatedAt) => {
      database.db
        .update(tasks)
        .set({ ...model, updatedAt })
        .where(eq(tasks.id, taskId))
        .run();
      return database.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    },
    updateTaskSession: (taskId, session) => {
      database.db
        .update(tasks)
        .set({
          sessionCreatedAt: session.createdAt,
          sessionId: session.id,
          sessionPath: session.path
        })
        .where(eq(tasks.id, taskId))
        .run();
      return database.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    },
    updateTaskStatus: (taskId, status, updatedAt) => {
      database.db
        .update(tasks)
        .set({ status, updatedAt })
        .where(eq(tasks.id, taskId))
        .run();
      return database.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    }
  };
}

function sortTasksDescending(taskRows: TaskRow[]): TaskRow[] {
  return [...taskRows].sort((left, right) =>
    String(right.lastContinuedAt).localeCompare(String(left.lastContinuedAt))
  );
}

function toTaskRow(task: NewTaskRow): TaskRow {
  return {
    ...task,
    lastContinuedAt: task.lastContinuedAt ?? null,
    lastModelId: task.lastModelId ?? null,
    sessionCreatedAt: task.sessionCreatedAt ?? null,
    sessionId: task.sessionId ?? null,
    sessionPath: task.sessionPath ?? null,
    status: task.status ?? "completed"
  };
}
