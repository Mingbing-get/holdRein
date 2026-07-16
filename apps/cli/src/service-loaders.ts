import type {
  ScheduledTasksService,
  UsageStatsService,
  WorkspacesService
} from "./types";

export async function getDefaultWorkspacesService(): Promise<WorkspacesService> {
  const repository = await createWorkspaceRepository();

  return {
    deleteWorkspace: async (workspaceId) => {
      if (!repository.findWorkspaceById(workspaceId)) {
        return { status: "not_found", workspaceId };
      }

      const workspaceTasks = repository.listAllTasksByWorkspaceId(workspaceId);

      if (workspaceTasks.some((task) => task.status === "running")) {
        return { status: "has_running_tasks", workspaceId };
      }

      await Promise.all(
        workspaceTasks
          .map((task) => task.sessionPath)
          .filter((sessionPath): sessionPath is string => Boolean(sessionPath))
          .map(deleteSessionFile)
      );
      repository.deleteTasksByWorkspaceId(workspaceId);
      repository.deleteWorkspaceById(workspaceId);

      return { status: "deleted", workspaceId };
    },
    getWorkspaceSetting: async (workspaceId) => {
      const { createWorkspaceSettingsService } =
        await importWorkspaceSettingsModule();
      return createWorkspaceSettingsService({ repository }).getWorkspaceSetting(
        workspaceId
      );
    },
    listRecentWorkspaceTasks: () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const workspaces = repository.listWorkspaces().map((workspace) => {
        const tasks = repository
          .listTasksByWorkspaceId({ limit: 500, workspaceId: workspace.id })
          .filter(
            (task) =>
              task.lastContinuedAt !== null && task.lastContinuedAt >= cutoff
          );

        return {
          hasMore: false,
          id: workspace.id,
          name: workspace.name,
          path: workspace.path,
          tasks: tasks.map(toWorkspaceTaskSummary)
        };
      });

      return { workspaces };
    },
    listWorkspaceTasksAfter: ({ afterLastContinuedAt, limit, workspaceId }) => {
      if (!repository.findWorkspaceById(workspaceId)) return undefined;

      const tasks = repository.listTasksAfterLastContinuedAt({
        afterLastContinuedAt,
        limit: limit + 1,
        workspaceId
      });

      return {
        hasMore: tasks.length > limit,
        tasks: tasks.slice(0, limit).map(toWorkspaceTaskSummary),
        workspaceId
      };
    },
    updateWorkspaceSetting: async (workspaceId, input) => {
      const { createWorkspaceSettingsService } =
        await importWorkspaceSettingsModule();
      return createWorkspaceSettingsService({ repository }).updateWorkspaceSetting(
        workspaceId,
        input
      );
    }
  };
}

export async function getDefaultScheduledTasksService(): Promise<ScheduledTasksService> {
  const module = (await import(
    new URL("./runtime/api/modules/scheduled-tasks/scheduled-tasks-service.js", import.meta.url).href
  )) as {
    getDefaultScheduledTasksService: () => ScheduledTasksService;
  };

  return module.getDefaultScheduledTasksService();
}

export async function getDefaultUsageStatsService(): Promise<UsageStatsService> {
  const module = (await import(
    new URL("./runtime/api/modules/usage-stats/default-usage-stats-service.js", import.meta.url).href
  )) as {
    getDefaultUsageStatsService: () => UsageStatsService;
  };

  return module.getDefaultUsageStatsService();
}

interface WorkspaceTaskRow {
  readonly approvalPolicy: string;
  readonly id: string;
  readonly initialUserMessage: string;
  readonly lastContinuedAt: string | null;
  readonly lastModelId: string | null;
  readonly lastModelName: string;
  readonly lastModelProvider: string;
  readonly lastModelProviderSource: string;
  readonly sessionPath: string | null;
  readonly sourceMark: string | null;
  readonly sourceType: string;
  readonly status: string;
  readonly thinkingLevel: string;
  readonly title: string;
}

interface WorkspaceRepository {
  readonly deleteTasksByWorkspaceId: (workspaceId: string) => void;
  readonly deleteWorkspaceById: (workspaceId: string) => void;
  readonly findWorkspaceById: (workspaceId: string) => unknown;
  readonly listAllTasksByWorkspaceId: (workspaceId: string) => WorkspaceTaskRow[];
  readonly listTasksAfterLastContinuedAt: (input: {
    readonly afterLastContinuedAt: string;
    readonly limit: number;
    readonly workspaceId: string;
  }) => WorkspaceTaskRow[];
  readonly listTasksByWorkspaceId: (input: {
    readonly limit: number;
    readonly workspaceId: string;
  }) => WorkspaceTaskRow[];
  readonly listWorkspaces: () => {
    readonly id: string;
    readonly name: string;
    readonly path: string;
  }[];
}

async function createWorkspaceRepository(): Promise<WorkspaceRepository> {
  const [{ DB_FILE }, { loadApiEnv }, { createDatabase, migrateDatabase }, repositoryModule] =
    await Promise.all([
      import(new URL("./runtime/api/config/const.js", import.meta.url).href) as Promise<{
        DB_FILE: string;
      }>,
      import(new URL("./runtime/api/config/env.js", import.meta.url).href) as Promise<{
        loadApiEnv: () => void;
      }>,
      import(new URL("./runtime/api/db/index.js", import.meta.url).href) as Promise<{
        createDatabase: (path: string) => { sqlite: unknown };
        migrateDatabase: (sqlite: unknown) => void;
      }>,
      import(
        new URL("./runtime/api/modules/workspaces/workspace-repository.js", import.meta.url)
          .href
      ) as Promise<{
        createSqliteWorkspaceRepository: (database: unknown) => WorkspaceRepository;
      }>
    ]);

  loadApiEnv();
  const database = createDatabase(process.env.SQLITE_DB_PATH ?? DB_FILE);
  migrateDatabase(database.sqlite);

  return repositoryModule.createSqliteWorkspaceRepository(database);
}

async function importWorkspaceSettingsModule(): Promise<{
  createWorkspaceSettingsService: (input: {
    repository: WorkspaceRepository;
  }) => {
    getWorkspaceSetting: (workspaceId: string) => Promise<unknown>;
    updateWorkspaceSetting: (
      workspaceId: string,
      input: unknown
    ) => Promise<unknown>;
  };
}> {
  return import(
    new URL("./runtime/api/modules/workspaces/workspace-settings.js", import.meta.url)
      .href
  ) as Promise<{
    createWorkspaceSettingsService: (input: {
      repository: WorkspaceRepository;
    }) => {
      getWorkspaceSetting: (workspaceId: string) => Promise<unknown>;
      updateWorkspaceSetting: (
        workspaceId: string,
        input: unknown
      ) => Promise<unknown>;
    };
  }>;
}

async function deleteSessionFile(sessionPath: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");

  try {
    await unlink(sessionPath);
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function toWorkspaceTaskSummary(task: WorkspaceTaskRow) {
  if (task.lastContinuedAt === null) {
    throw new Error("Task summary requires lastContinuedAt");
  }

  return {
    approvalPolicy: task.approvalPolicy,
    id: task.id,
    initialUserMessage: task.initialUserMessage,
    lastContinuedAt: task.lastContinuedAt,
    lastModelId: task.lastModelId,
    lastModelName: task.lastModelName,
    lastModelProvider: task.lastModelProvider,
    lastModelProviderSource: task.lastModelProviderSource,
    sourceMark: task.sourceMark,
    sourceType: task.sourceType,
    status: task.status,
    thinkingLevel: task.thinkingLevel,
    title: task.title
  };
}
