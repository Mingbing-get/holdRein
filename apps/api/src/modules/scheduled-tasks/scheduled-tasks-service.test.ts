import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { createInMemoryScheduledTasksRepository } from "./scheduled-tasks-repository";
import {
  createScheduledTasksService,
  getDefaultScheduledTasksService
} from "./scheduled-tasks-service";

const NOW = new Date("2026-07-02T00:01:00.000Z");

describe("scheduled tasks service", () => {
  it("creates a scheduled task with next run metadata and reloads the scheduler", () => {
    const { scheduler, service } = createTestService();

    const task = service.createScheduledTask(createInput());

    expect(task).toEqual(
      expect.objectContaining({
        enabled: true,
        nextRunAt: "2026-07-02T00:05:00.000Z"
      })
    );
    expect(scheduler.reloadTask).toHaveBeenCalledWith(task.id);
  });

  it("rejects invalid cron and empty required fields", () => {
    const { service } = createTestService();

    expect(() =>
      service.createScheduledTask(createInput({ cronExpression: "not cron" }))
    ).toThrow("Invalid cron expression");
    expect(() => service.createScheduledTask(createInput({ name: "" }))).toThrow(
      "name is required"
    );
    expect(() =>
      service.createScheduledTask(createInput({ thinkingLevel: "turbo" as never }))
    ).toThrow("Invalid thinking level");
  });

  it("updates cron metadata and reloads the scheduler", () => {
    const { scheduler, service } = createTestService();
    const task = service.createScheduledTask(createInput());

    const updated = service.updateScheduledTask(task.id, {
      cronExpression: "*/10 * * * *"
    });

    expect(updated).toEqual(
      expect.objectContaining({
        cronExpression: "*/10 * * * *",
        nextRunAt: "2026-07-02T00:10:00.000Z"
      })
    );
    expect(scheduler.reloadTask).toHaveBeenLastCalledWith(task.id);
  });

  it("lists scheduled tasks for a workspace", () => {
    const { service } = createTestService();
    const workspaceTask = service.createScheduledTask(
      createInput({ workspacePath: "/tmp/workspace-a" })
    );
    service.createScheduledTask(createInput({ workspacePath: "/tmp/workspace-b" }));

    expect(
      service.listScheduledTasks({ workspacePath: "/tmp/workspace-a" })
    ).toEqual([workspaceTask]);
  });

  it("enables, disables, and deletes scheduled tasks", () => {
    const { scheduler, service } = createTestService();
    const task = service.createScheduledTask(createInput());

    expect(service.disableScheduledTask(task.id)).toEqual(
      expect.objectContaining({ enabled: false })
    );
    expect(service.enableScheduledTask(task.id)).toEqual(
      expect.objectContaining({ enabled: true })
    );
    expect(service.deleteScheduledTask(task.id)).toBe(true);
    expect(service.findScheduledTask(task.id)).toBeUndefined();
    expect(scheduler.reloadTask).toHaveBeenCalledWith(task.id);
    expect(service.deleteScheduledTask("missing")).toBe(false);
  });

  it("creates a default SQLite-backed service with start and stop methods", () => {
    process.env.SQLITE_DB_PATH = join(
      mkdtempSync(join(tmpdir(), "hold-rein-default-scheduled-")),
      "test.sqlite"
    );
    const service = getDefaultScheduledTasksService({
      agentsService: { startAgent: vi.fn() }
    });

    expect(service.start).toEqual(expect.any(Function));
    expect(service.stop).toEqual(expect.any(Function));

    service.start();
    service.stop();
  });

  it("creates a default SQLite-backed management service without an agents service", () => {
    process.env.SQLITE_DB_PATH = join(
      mkdtempSync(join(tmpdir(), "hold-rein-default-scheduled-management-")),
      "test.sqlite"
    );
    const service = getDefaultScheduledTasksService();

    expect("start" in service).toBe(false);
    expect("stop" in service).toBe(false);

    const task = service.createScheduledTask(createInput());

    expect(service.findScheduledTask(task.id)).toEqual(task);
  });
});

function createTestService() {
  const scheduler = {
    reloadAll: vi.fn(),
    reloadTask: vi.fn(),
    start: vi.fn(),
    stop: vi.fn()
  };
  const service = createScheduledTasksService({
    now: () => NOW,
    repository: createInMemoryScheduledTasksRepository(),
    scheduler
  });

  return { scheduler, service };
}

function createInput(
  input: Partial<Parameters<ReturnType<typeof createScheduledTasksService>["createScheduledTask"]>[0]> = {}
) {
  return {
    allowConcurrentRuns: false,
    cronExpression: "*/5 * * * *",
    modelId: "gpt-4.1",
    name: "Every five minutes",
    prompt: "Run scheduled check",
    provider: "openai",
    thinkingLevel: "medium" as const,
    timezone: "Asia/Shanghai",
    workspacePath: "/tmp/workspace",
    ...input
  };
}
