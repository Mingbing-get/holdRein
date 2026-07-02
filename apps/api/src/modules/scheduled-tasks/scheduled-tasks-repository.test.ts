import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createDatabase, migrateDatabase, type ScheduledAgentTaskRow } from "../../db";
import {
  createInMemoryScheduledTasksRepository,
  createSqliteScheduledTasksRepository,
  type ScheduledTasksRepository
} from "./scheduled-tasks-repository";

describe.each([
  ["in-memory", createInMemoryScheduledTasksRepository],
  ["sqlite", createSqliteFixture]
] satisfies [string, () => ScheduledTasksRepository][])(
  "scheduled tasks repository (%s)",
  (_name, createRepository) => {
    it("creates, finds, and lists scheduled tasks", () => {
      const repository = createRepository();
      const created = repository.createScheduledTask(createScheduledTask());

      expect(repository.findScheduledTaskById("scheduled-1")).toEqual(created);
      expect(repository.listScheduledTasks()).toEqual([created]);
      expect(repository.listEnabledScheduledTasks()).toEqual([created]);
    });

    it("lists only enabled scheduled tasks", () => {
      const repository = createRepository();
      const enabled = repository.createScheduledTask(createScheduledTask());
      repository.createScheduledTask(
        createScheduledTask({ enabled: false, id: "scheduled-disabled" })
      );

      expect(repository.listEnabledScheduledTasks()).toEqual([enabled]);
    });

    it("lists scheduled tasks by workspace path", () => {
      const repository = createRepository();
      const workspaceTask = repository.createScheduledTask(
        createScheduledTask({ workspacePath: "/tmp/workspace-a" })
      );
      repository.createScheduledTask(
        createScheduledTask({
          id: "scheduled-2",
          workspacePath: "/tmp/workspace-b"
        })
      );

      expect(
        repository.listScheduledTasks({ workspacePath: "/tmp/workspace-a" })
      ).toEqual([workspaceTask]);
    });

    it("updates scheduled task fields", () => {
      const repository = createRepository();
      repository.createScheduledTask(createScheduledTask());

      expect(
        repository.updateScheduledTask("scheduled-1", {
          enabled: false,
          name: "Paused schedule",
          updatedAt: "2026-07-02T00:02:00.000Z"
        })
      ).toEqual(
        expect.objectContaining({
          enabled: false,
          name: "Paused schedule",
          updatedAt: "2026-07-02T00:02:00.000Z"
        })
      );
      expect(repository.updateScheduledTask("missing", { name: "Missing" })).toBeUndefined();
    });

    it("updates run metadata", () => {
      const repository = createRepository();
      repository.createScheduledTask(createScheduledTask());

      expect(
        repository.updateScheduledTaskRunMetadata("scheduled-1", {
          lastRunAt: "2026-07-02T00:05:00.000Z",
          nextRunAt: "2026-07-02T00:10:00.000Z",
          updatedAt: "2026-07-02T00:05:00.000Z"
        })
      ).toEqual(
        expect.objectContaining({
          lastRunAt: "2026-07-02T00:05:00.000Z",
          nextRunAt: "2026-07-02T00:10:00.000Z",
          updatedAt: "2026-07-02T00:05:00.000Z"
        })
      );
      expect(
        repository.updateScheduledTaskRunMetadata("missing", {
          lastRunAt: "2026-07-02T00:05:00.000Z",
          nextRunAt: "2026-07-02T00:10:00.000Z",
          updatedAt: "2026-07-02T00:05:00.000Z"
        })
      ).toBeUndefined();
    });

    it("deletes scheduled tasks by id", () => {
      const repository = createRepository();
      repository.createScheduledTask(createScheduledTask());

      repository.deleteScheduledTaskById("scheduled-1");

      expect(repository.findScheduledTaskById("scheduled-1")).toBeUndefined();
      expect(repository.listScheduledTasks()).toEqual([]);
    });
  }
);

function createSqliteFixture(): ScheduledTasksRepository {
  const database = createDatabase(
    join(mkdtempSync(join(tmpdir(), "hold-rein-scheduled-repo-")), "test.sqlite")
  );
  migrateDatabase(database.sqlite);
  return createSqliteScheduledTasksRepository(database);
}

function createScheduledTask(
  input: Partial<ScheduledAgentTaskRow> = {}
): ScheduledAgentTaskRow {
  return {
    allowConcurrentRuns: false,
    createdAt: "2026-07-02T00:00:00.000Z",
    cronExpression: "*/5 * * * *",
    enabled: true,
    id: "scheduled-1",
    lastRunAt: null,
    modelId: "gpt-4.1",
    name: "Every five minutes",
    nextRunAt: "2026-07-02T00:05:00.000Z",
    prompt: "Run scheduled check",
    provider: "openai",
    thinkingLevel: "medium",
    timezone: "Asia/Shanghai",
    updatedAt: "2026-07-02T00:00:00.000Z",
    workspacePath: "/tmp/workspace",
    ...input
  };
}
