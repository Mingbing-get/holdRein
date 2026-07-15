import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import type { PersistedXiangqiTaskGame } from "../shared";

export interface XiangqiTaskGameStorage {
  readonly deleteGame: (taskId: string) => Promise<void>;
  readonly readGame: (taskId: string) => Promise<PersistedXiangqiTaskGame | null>;
  readonly writeGame: (game: PersistedXiangqiTaskGame) => Promise<void>;
}

export interface CreateXiangqiTaskGameStorageOptions {
  readonly storageRoot?: string;
}

export function createXiangqiTaskGameStorage(
  options: CreateXiangqiTaskGameStorageOptions = {}
): XiangqiTaskGameStorage {
  const storageRoot = options.storageRoot ?? defaultStorageRoot();

  return {
    async deleteGame(taskId) {
      await rm(taskFilePath(storageRoot, taskId), { force: true });
    },
    async readGame(taskId) {
      try {
        const raw = await readFile(taskFilePath(storageRoot, taskId), "utf8");
        return JSON.parse(raw) as PersistedXiangqiTaskGame;
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }
        throw error;
      }
    },
    async writeGame(game) {
      const path = taskFilePath(storageRoot, game.taskId);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${JSON.stringify(game, null, 2)}\n`, "utf8");
    }
  };
}

function defaultStorageRoot(): string {
  return join(homedir(), ".hold-rein", "plugin-data", "xiangqi");
}

function taskFilePath(storageRoot: string, taskId: string): string {
  return join(storageRoot, "tasks", `${taskFileName(taskId)}.json`);
}

function taskFileName(taskId: string): string {
  if (/^[A-Za-z0-9._-]+$/u.test(taskId)) {
    return taskId;
  }

  return createHash("sha256").update(taskId).digest("hex");
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
