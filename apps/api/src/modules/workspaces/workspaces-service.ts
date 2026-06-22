import { unlink } from "node:fs/promises";

import type { ActiveTaskRunRegistry } from "../agents/task/active-run-registry";
import type {
  RecentWorkspaceTasksResult,
  WorkspaceNavigationTaskRow,
  WorkspaceTaskPageResult,
  WorkspaceTaskSummary,
  WorkspaceWithTasksSummary
} from "./workspace-types";
import type { WorkspaceRepository } from "./workspace-repository";

export interface CreateWorkspacesServiceOptions {
  activeTaskRuns?: ActiveTaskRunRegistry;
  now?: () => Date;
  repository: WorkspaceRepository;
}

export interface ListWorkspaceTasksAfterOptions {
  afterLastContinuedAt: string;
  limit: number;
  workspaceId: string;
}

export interface WorkspacesService {
  deleteWorkspace: (workspaceId: string) => Promise<DeleteWorkspaceResult>;
  listRecentWorkspaceTasks: () => RecentWorkspaceTasksResult;
  listWorkspaceTasksAfter: (
    options: ListWorkspaceTasksAfterOptions
  ) => WorkspaceTaskPageResult | undefined;
}

export interface DeleteWorkspaceResult {
  status: "deleted" | "has_running_tasks" | "not_found";
  workspaceId: string;
}

const RECENT_TASK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RECENT_TASK_FETCH_LIMIT = 500;

export function createWorkspacesService({
  activeTaskRuns,
  now = () => new Date(),
  repository
}: CreateWorkspacesServiceOptions): WorkspacesService {
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
          tasks: recentTasks.map((task) =>
            toTaskSummary(
              resolveTaskStatus(task, activeTaskRuns, repository, now),
              activeTaskRuns
            )
          )
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
        tasks: tasks
          .slice(0, limit)
          .map((task) =>
            toTaskSummary(
              resolveTaskStatus(task, activeTaskRuns, repository, now),
              activeTaskRuns
            )
          ),
        workspaceId
      };
    }
  };
}

async function deleteSessionFile(sessionPath: string): Promise<void> {
  try {
    await unlink(sessionPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function resolveTaskStatus(
  task: WorkspaceNavigationTaskRow,
  activeTaskRuns: ActiveTaskRunRegistry | undefined,
  repository: WorkspaceRepository,
  now: () => Date
): WorkspaceNavigationTaskRow {
  if (
    task.status !== "running" ||
    !activeTaskRuns ||
    activeTaskRuns.hasTask(task.id)
  ) {
    return task;
  }

  return repository.updateTaskStatus(task.id, "error", now().toISOString()) ?? task;
}

function toTaskSummary(
  task: WorkspaceNavigationTaskRow,
  activeTaskRuns?: ActiveTaskRunRegistry
): WorkspaceTaskSummary {
  if (task.lastContinuedAt === null) {
    throw new Error("Task summary requires lastContinuedAt");
  }

  const activeAgentId = activeTaskRuns?.getAgentId(task.id);

  return {
    ...(activeAgentId ? { activeAgentId } : {}),
    approvalPolicy: task.approvalPolicy,
    id: task.id,
    initialUserMessage: task.initialUserMessage,
    lastContinuedAt: task.lastContinuedAt,
    lastModelName: task.lastModelName,
    lastModelProvider: task.lastModelProvider,
    lastModelProviderSource: task.lastModelProviderSource,
    status: task.status,
    thinkingLevel: task.thinkingLevel,
    title: task.title
  };
}
