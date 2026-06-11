import type {
  RecentWorkspaceTasksResult,
  WorkspaceNavigationTaskRow,
  WorkspaceTaskPageResult,
  WorkspaceTaskSummary,
  WorkspaceWithTasksSummary
} from "./workspace-types";
import type { WorkspaceRepository } from "./workspace-repository";

export interface CreateWorkspacesServiceOptions {
  now?: () => Date;
  repository: WorkspaceRepository;
}

export interface ListWorkspaceTasksAfterOptions {
  afterLastContinuedAt: string;
  limit: number;
  workspaceId: string;
}

export interface WorkspacesService {
  listRecentWorkspaceTasks: () => RecentWorkspaceTasksResult;
  listWorkspaceTasksAfter: (
    options: ListWorkspaceTasksAfterOptions
  ) => WorkspaceTaskPageResult | undefined;
}

const RECENT_TASK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_TASK_FETCH_LIMIT = 500;

export function createWorkspacesService({
  now = () => new Date(),
  repository
}: CreateWorkspacesServiceOptions): WorkspacesService {
  return {
    listRecentWorkspaceTasks: () => {
      const cutoff = new Date(now().getTime() - RECENT_TASK_WINDOW_MS).toISOString();
      const workspaceSummaries = repository.listWorkspaces().map((workspace) => {
        const tasks = repository.listTasksByWorkspaceId({
          limit: RECENT_TASK_FETCH_LIMIT,
          workspaceId: workspace.id
        });
        const recentTasks = tasks.filter(
          (task) =>
            task.lastContinuedAt !== null && task.lastContinuedAt >= cutoff
        );
        const summary: WorkspaceWithTasksSummary = {
          hasMore: tasks.some(
            (task) =>
              task.lastContinuedAt !== null && task.lastContinuedAt < cutoff
          ),
          id: workspace.id,
          name: workspace.name,
          path: workspace.path,
          tasks: recentTasks.map(toTaskSummary)
        };

        return summary;
      });

      return { workspaces: workspaceSummaries };
    },
    listWorkspaceTasksAfter: ({ afterLastContinuedAt, limit, workspaceId }) => {
      if (!repository.findWorkspaceById(workspaceId)) {
        return undefined;
      }

      const tasks = repository.listTasksAfterLastContinuedAt({
        afterLastContinuedAt,
        limit: limit + 1,
        workspaceId
      });

      return {
        hasMore: tasks.length > limit,
        tasks: tasks.slice(0, limit).map(toTaskSummary),
        workspaceId
      };
    }
  };
}

function toTaskSummary(task: WorkspaceNavigationTaskRow): WorkspaceTaskSummary {
  if (task.lastContinuedAt === null) {
    throw new Error("Task summary requires lastContinuedAt");
  }

  return {
    id: task.id,
    initialUserMessage: task.initialUserMessage,
    lastContinuedAt: task.lastContinuedAt,
    lastModelName: task.lastModelName,
    lastModelProvider: task.lastModelProvider,
    lastModelProviderSource: task.lastModelProviderSource,
    status: task.status,
    title: task.title
  };
}
