import { describe, expect, it, vi } from "vitest";

import type { ScheduledAgentTaskRow } from "../../db";
import { createInMemoryScheduledTasksRepository } from "./scheduled-tasks-repository";
import { createScheduledTaskScheduler } from "./scheduled-task-scheduler";

describe("scheduled task scheduler", () => {
  it("starts enabled tasks and stops registered jobs", () => {
    const repository = createInMemoryScheduledTasksRepository();
    repository.createScheduledTask(createScheduledTask({ id: "enabled-task" }));
    repository.createScheduledTask(
      createScheduledTask({ enabled: false, id: "disabled-task" })
    );
    const cron = createFakeCron();
    const scheduler = createScheduledTaskScheduler({
      agentsService: { startAgent: vi.fn() },
      cron,
      repository,
      workspaceRepository: { findRunningTaskBySource: vi.fn() }
    });

    scheduler.start();

    expect(cron.scheduled.map((job) => job.expression)).toEqual(["*/5 * * * *"]);
    expect(cron.scheduled.map((job) => job.options.timezone)).toEqual([
      "Asia/Shanghai"
    ]);

    scheduler.stop();

    expect(cron.scheduled[0]?.task.stop).toHaveBeenCalledTimes(1);
  });

  it("reloads a single task by replacing any existing job", () => {
    const repository = createInMemoryScheduledTasksRepository();
    repository.createScheduledTask(createScheduledTask({ id: "scheduled-1" }));
    const cron = createFakeCron();
    const scheduler = createScheduledTaskScheduler({
      agentsService: { startAgent: vi.fn() },
      cron,
      repository,
      workspaceRepository: { findRunningTaskBySource: vi.fn() }
    });

    scheduler.start();
    repository.updateScheduledTask("scheduled-1", {
      cronExpression: "*/10 * * * *",
      updatedAt: "2026-07-02T00:01:00.000Z"
    });
    scheduler.reloadTask("scheduled-1");

    expect(cron.scheduled[0]?.task.stop).toHaveBeenCalledTimes(1);
    expect(cron.scheduled.map((job) => job.expression)).toEqual([
      "*/5 * * * *",
      "*/10 * * * *"
    ]);
  });

  it("does not register disabled tasks on reload", () => {
    const repository = createInMemoryScheduledTasksRepository();
    repository.createScheduledTask(
      createScheduledTask({ enabled: false, id: "scheduled-1" })
    );
    const cron = createFakeCron();
    const scheduler = createScheduledTaskScheduler({
      agentsService: { startAgent: vi.fn() },
      cron,
      repository,
      workspaceRepository: { findRunningTaskBySource: vi.fn() }
    });

    scheduler.reloadTask("scheduled-1");

    expect(cron.scheduled).toEqual([]);
  });

  it("starts an agent from a scheduled trigger and updates run metadata", async () => {
    const repository = createInMemoryScheduledTasksRepository();
    repository.createScheduledTask(createScheduledTask({ id: "scheduled-1" }));
    const cron = createFakeCron();
    const startAgent = vi.fn().mockResolvedValue({});
    const scheduler = createScheduledTaskScheduler({
      agentsService: { startAgent },
      cron,
      now: () => new Date("2026-07-02T00:01:00.000Z"),
      repository,
      workspaceRepository: { findRunningTaskBySource: vi.fn() }
    });

    scheduler.start();
    await cron.scheduled[0]?.trigger();

    expect(startAgent).toHaveBeenCalledWith({
      approvalPolicy: "run_all",
      modelId: "gpt-4.1",
      prompt: "Run scheduled check",
      provider: "openai",
      source: { mark: "scheduled-1", type: "scheduled" },
      thinkingLevel: "medium",
      workspacePath: "/tmp/workspace"
    });
    expect(repository.findScheduledTaskById("scheduled-1")).toEqual(
      expect.objectContaining({
        lastRunAt: "2026-07-02T00:01:00.000Z",
        nextRunAt: "2026-07-02T00:05:00.000Z"
      })
    );
  });

  it("skips a trigger when concurrent runs are blocked by a running task", async () => {
    const repository = createInMemoryScheduledTasksRepository();
    repository.createScheduledTask(createScheduledTask({ id: "scheduled-1" }));
    const cron = createFakeCron();
    const startAgent = vi.fn();
    const scheduler = createScheduledTaskScheduler({
      agentsService: { startAgent },
      cron,
      repository,
      workspaceRepository: {
        findRunningTaskBySource: vi.fn().mockReturnValue({ id: "running-task" })
      }
    });

    scheduler.start();
    await cron.scheduled[0]?.trigger();

    expect(startAgent).not.toHaveBeenCalled();
    expect(repository.findScheduledTaskById("scheduled-1")?.lastRunAt).toBeNull();
  });
});

function createFakeCron() {
  const scheduled: {
    expression: string;
    options: { timezone?: string };
    task: { stop: ReturnType<typeof vi.fn> };
    trigger: () => Promise<void>;
  }[] = [];

  return {
    scheduled,
    schedule: (
      expression: string,
      callback: () => void | Promise<void>,
      options: { timezone?: string }
    ) => {
      const task = { stop: vi.fn() };
      scheduled.push({
        expression,
        options,
        task,
        trigger: async () => {
          await callback();
        }
      });
      return task;
    }
  };
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
