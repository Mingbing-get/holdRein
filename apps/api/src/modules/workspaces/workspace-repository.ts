import { and, desc, eq, sql } from "drizzle-orm";

import type {
  AppDatabase,
  ModelTokenUsageHourlyRow,
  NewModelTokenUsageHourlyRow,
  NewTaskRow,
  NewWorkspaceRow,
  TaskRow,
  WorkspaceRow
} from "../../db";
import { modelTokenUsageHourly, tasks, workspaces } from "../../db";

export interface WorkspaceRepositorySeed {
  tasks: NewTaskRow[];
  workspaces: NewWorkspaceRow[];
}

export interface ListWorkspaceTasksInput {
  limit: number;
  workspaceId: string;
}

export interface ListWorkspaceTasksAfterInput extends ListWorkspaceTasksInput {
  afterLastContinuedAt: string;
}

export interface WorkspaceRepository {
  addModelTokenUsageHourly: (
    usage: NewModelTokenUsageHourlyRow
  ) => ModelTokenUsageHourlyRow;
  addTaskTokenUsage: (
    taskId: string,
    usage: Pick<TaskRow, "inputToken" | "outputToken">
  ) => TaskRow | undefined;
  createTask: (task: NewTaskRow) => TaskRow;
  createWorkspace: (workspace: NewWorkspaceRow) => WorkspaceRow;
  deleteTaskById: (taskId: string) => void;
  deleteTasksByWorkspaceId: (workspaceId: string) => void;
  deleteWorkspaceById: (workspaceId: string) => void;
  findTaskById: (taskId: string) => TaskRow | undefined;
  findRunningTaskBySource: (input: {
    sourceMark: string;
    sourceType: "scheduled";
  }) => TaskRow | undefined;
  findWorkspaceById: (workspaceId: string) => WorkspaceRow | undefined;
  findWorkspaceByPath: (workspacePath: string) => WorkspaceRow | undefined;
  listTasksAfterLastContinuedAt: (
    input: ListWorkspaceTasksAfterInput
  ) => TaskRow[];
  listAllTasksByWorkspaceId: (workspaceId: string) => TaskRow[];
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
  updateTaskOptions: (
    taskId: string,
    options: Pick<TaskRow, "approvalPolicy" | "thinkingLevel">,
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
  const workspaceRows = seed.workspaces.map((workspace) => workspace);
  const taskRows = seed.tasks.map(toTaskRow);
  const modelTokenUsageHourlyRows: ModelTokenUsageHourlyRow[] = [];

  return {
    addModelTokenUsageHourly: (usage) => {
      const hour = normalizeUsageHour(usage.hour);
      const existingIndex = modelTokenUsageHourlyRows.findIndex(
        (row) =>
          row.provider === usage.provider &&
          row.modelName === usage.modelName &&
          row.hour === hour
      );
      const existingUsage = modelTokenUsageHourlyRows[existingIndex];
      const nextUsage = {
        hour,
        inputToken: (existingUsage?.inputToken ?? 0) + (usage.inputToken ?? 0),
        modelName: usage.modelName,
        outputToken: (existingUsage?.outputToken ?? 0) + (usage.outputToken ?? 0),
        provider: usage.provider
      };

      if (existingIndex >= 0) {
        modelTokenUsageHourlyRows[existingIndex] = nextUsage;
      } else {
        modelTokenUsageHourlyRows.push(nextUsage);
      }

      return nextUsage;
    },
    addTaskTokenUsage: (taskId, usage) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = {
        ...existingTask,
        inputToken: existingTask.inputToken + usage.inputToken,
        outputToken: existingTask.outputToken + usage.outputToken
      };
      taskRows[taskIndex] = nextTask;
      return nextTask;
    },
    createTask: (task) => {
      const row = toTaskRow(task);
      taskRows.push(row);

      return row;
    },
    createWorkspace: (workspace) => {
      workspaceRows.push(workspace);

      return workspace;
    },
    deleteTaskById: (taskId) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);

      if (taskIndex >= 0) {
        taskRows.splice(taskIndex, 1);
      }
    },
    deleteTasksByWorkspaceId: (workspaceId) => {
      for (let index = taskRows.length - 1; index >= 0; index -= 1) {
        if (taskRows[index]?.workspaceId === workspaceId) {
          taskRows.splice(index, 1);
        }
      }
    },
    deleteWorkspaceById: (workspaceId) => {
      const workspaceIndex = workspaceRows.findIndex(
        (workspace) => workspace.id === workspaceId
      );

      if (workspaceIndex >= 0) {
        workspaceRows.splice(workspaceIndex, 1);
      }
    },
    findTaskById: (taskId) => taskRows.find((task) => task.id === taskId),
    findRunningTaskBySource: (input) =>
      taskRows.find(
        (task) =>
          task.sourceType === input.sourceType &&
          task.sourceMark === input.sourceMark &&
          task.status === "running"
      ),
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
    listAllTasksByWorkspaceId: (workspaceId) =>
      taskRows.filter((task) => task.workspaceId === workspaceId),
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
    updateTaskOptions: (taskId, options, updatedAt) => {
      const taskIndex = taskRows.findIndex((task) => task.id === taskId);
      const existingTask = taskRows[taskIndex];
      if (!existingTask) return undefined;
      const nextTask = { ...existingTask, ...options, updatedAt };
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
    addModelTokenUsageHourly: (usage) => {
      const row = {
        ...usage,
        hour: normalizeUsageHour(usage.hour),
        inputToken: usage.inputToken ?? 0,
        outputToken: usage.outputToken ?? 0
      };

      database.db
        .insert(modelTokenUsageHourly)
        .values(row)
        .onConflictDoUpdate({
          set: {
            inputToken: sql`${modelTokenUsageHourly.inputToken} + ${row.inputToken}`,
            outputToken: sql`${modelTokenUsageHourly.outputToken} + ${row.outputToken}`
          },
          target: [
            modelTokenUsageHourly.provider,
            modelTokenUsageHourly.modelName,
            modelTokenUsageHourly.hour
          ]
        })
        .run();

      return database.db
        .select()
        .from(modelTokenUsageHourly)
        .where(sql`
          ${modelTokenUsageHourly.provider} = ${row.provider}
          AND ${modelTokenUsageHourly.modelName} = ${row.modelName}
          AND ${modelTokenUsageHourly.hour} = ${row.hour}
        `)
        .get() as ModelTokenUsageHourlyRow;
    },
    addTaskTokenUsage: (taskId, usage) => {
      database.db
        .update(tasks)
        .set({
          inputToken: sql`${tasks.inputToken} + ${usage.inputToken}`,
          outputToken: sql`${tasks.outputToken} + ${usage.outputToken}`
        })
        .where(eq(tasks.id, taskId))
        .run();

      return database.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    },
    createTask: (task) => {
      const row = toTaskRow(task);
      database.db.insert(tasks).values(row).run();

      return row;
    },
    createWorkspace: (workspace) => {
      database.db.insert(workspaces).values(workspace).run();

      return workspace;
    },
    deleteTaskById: (taskId) => {
      database.db.delete(tasks).where(eq(tasks.id, taskId)).run();
    },
    deleteTasksByWorkspaceId: (workspaceId) => {
      database.db.delete(tasks).where(eq(tasks.workspaceId, workspaceId)).run();
    },
    deleteWorkspaceById: (workspaceId) => {
      database.db.delete(workspaces).where(eq(workspaces.id, workspaceId)).run();
    },
    findTaskById: (taskId) =>
      database.db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .get(),
    findRunningTaskBySource: (input) =>
      database.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.sourceType, input.sourceType),
            eq(tasks.sourceMark, input.sourceMark),
            eq(tasks.status, "running")
          )
        )
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
    listAllTasksByWorkspaceId: (workspaceId) =>
      database.db
        .select()
        .from(tasks)
        .where(eq(tasks.workspaceId, workspaceId))
        .all(),
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
    updateTaskOptions: (taskId, options, updatedAt) => {
      database.db
        .update(tasks)
        .set({ ...options, updatedAt })
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

function normalizeUsageHour(hour: string): string {
  const date = new Date(hour);
  date.setUTCMinutes(0, 0, 0);

  return date.toISOString();
}

function toTaskRow(task: NewTaskRow): TaskRow {
  return {
    ...task,
    approvalPolicy: task.approvalPolicy ?? "approval",
    lastContinuedAt: task.lastContinuedAt ?? null,
    lastModelId: task.lastModelId ?? null,
    inputToken: task.inputToken ?? 0,
    outputToken: task.outputToken ?? 0,
    sessionCreatedAt: task.sessionCreatedAt ?? null,
    sessionId: task.sessionId ?? null,
    sessionPath: task.sessionPath ?? null,
    sourceMark: task.sourceMark ?? null,
    sourceType: task.sourceType ?? "manual",
    status: task.status ?? "completed",
    thinkingLevel: task.thinkingLevel ?? "medium"
  };
}
