import { unlink } from "node:fs/promises";

import type { TaskTitleResult } from "./agent-types";
import type { WorkspaceRepository } from "../workspaces/workspace-repository";

export interface DeleteTaskResult {
  status: "deleted" | "not_found" | "running";
  taskId: string;
}

export async function deleteTask(
  repository: WorkspaceRepository,
  taskId: string
): Promise<DeleteTaskResult> {
  const task = repository.findTaskById(taskId);

  if (!task) {
    return { status: "not_found", taskId };
  }

  if (task.status === "running") {
    return { status: "running", taskId };
  }

  if (task.sessionPath) {
    await deleteSessionFile(task.sessionPath);
  }
  repository.deleteTaskById(taskId);

  return { status: "deleted", taskId };
}

export function renameTask(
  repository: WorkspaceRepository,
  taskId: string,
  title: string,
  updatedAt: string
): TaskTitleResult | null {
  const task = repository.updateTaskTitle(taskId, title, updatedAt);

  return task ? { id: task.id, title: task.title } : null;
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
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
