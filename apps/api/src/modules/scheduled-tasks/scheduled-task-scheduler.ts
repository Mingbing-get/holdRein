import cron from "node-cron";

import type { ScheduledAgentTaskRow } from "../../db";
import type { AgentsService } from "../agents/service";
import type { WorkspaceRepository } from "../workspaces/workspace-repository";
import { getNextRunAt } from "./cron";
import type { ScheduledTasksRepository } from "./scheduled-tasks-repository";

export interface ScheduledTaskScheduler {
  reloadAll: () => void;
  reloadTask: (id: string) => void;
  start: () => void;
  stop: () => void;
}

interface ScheduledCronTask {
  stop: () => void;
}

interface CronScheduler {
  schedule: (
    expression: string,
    callback: () => Promise<void>,
    options: { timezone: string }
  ) => ScheduledCronTask;
}

export interface CreateScheduledTaskSchedulerOptions {
  agentsService: Pick<AgentsService, "startAgent">;
  cron?: CronScheduler;
  now?: () => Date;
  repository: ScheduledTasksRepository;
  workspaceRepository: Pick<WorkspaceRepository, "findRunningTaskBySource">;
}

export function createScheduledTaskScheduler(
  options: CreateScheduledTaskSchedulerOptions
): ScheduledTaskScheduler {
  const jobs = new Map<string, ScheduledCronTask>();
  const cronScheduler = options.cron ?? cron;
  const now = options.now ?? (() => new Date());

  const registerTask = (task: ScheduledAgentTaskRow) => {
    if (!task.enabled) return;

    const job = cronScheduler.schedule(
      task.cronExpression,
      () => runScheduledTask(task.id),
      { timezone: task.timezone }
    );
    jobs.set(task.id, job);
  };

  const stopTask = (id: string) => {
    jobs.get(id)?.stop();
    jobs.delete(id);
  };

  const runScheduledTask = async (id: string) => {
    const task = options.repository.findScheduledTaskById(id);
    if (!task?.enabled) return;

    if (!task.allowConcurrentRuns) {
      const runningTask = options.workspaceRepository.findRunningTaskBySource({
        sourceMark: task.id,
        sourceType: "scheduled"
      });

      if (runningTask) return;
    }

    await options.agentsService.startAgent({
      approvalPolicy: "run_all",
      modelId: task.modelId,
      prompt: task.prompt,
      provider: task.provider,
      source: { mark: task.id, type: "scheduled" },
      thinkingLevel: task.thinkingLevel,
      workspacePath: task.workspacePath
    });

    const lastRunAt = now().toISOString();
    options.repository.updateScheduledTaskRunMetadata(task.id, {
      lastRunAt,
      nextRunAt: getNextRunAt({
        expression: task.cronExpression,
        now: new Date(lastRunAt),
        timezone: task.timezone
      }),
      updatedAt: lastRunAt
    });
  };

  return {
    reloadAll: () => {
      for (const id of jobs.keys()) {
        stopTask(id);
      }

      for (const task of options.repository.listEnabledScheduledTasks()) {
        registerTask(task);
      }
    },
    reloadTask: (id) => {
      stopTask(id);
      const task = options.repository.findScheduledTaskById(id);
      if (task) registerTask(task);
    },
    start: () => {
      for (const task of options.repository.listEnabledScheduledTasks()) {
        if (!jobs.has(task.id)) registerTask(task);
      }
    },
    stop: () => {
      for (const id of jobs.keys()) {
        stopTask(id);
      }
    }
  };
}
