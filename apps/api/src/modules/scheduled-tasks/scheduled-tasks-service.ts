import { randomUUID } from "node:crypto";

import type { ScheduledAgentTaskRow } from "../../db";
import { DB_FILE } from "../../config/const";
import { loadApiEnv } from "../../config/env";
import { createDatabase, migrateDatabase } from "../../db";
import type { AgentsService } from "../agents/service";
import { createSqliteWorkspaceRepository } from "../workspaces";
import { getNextRunAt, isValidCronExpression } from "./cron";
import {
  createScheduledTaskScheduler,
  type ScheduledTaskScheduler
} from "./scheduled-task-scheduler";
import {
  createSqliteScheduledTasksRepository,
  type ListScheduledTasksFilter,
  type ScheduledTasksRepository
} from "./scheduled-tasks-repository";
import type {
  ScheduledAgentTaskInput,
  ScheduledTaskThinkingLevel
} from "./scheduled-tasks-types";

export interface ScheduledTasksService {
  createScheduledTask: (
    input: ScheduledAgentTaskInput
  ) => ScheduledAgentTaskRow;
  deleteScheduledTask: (id: string) => boolean;
  disableScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  enableScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  findScheduledTask: (id: string) => ScheduledAgentTaskRow | undefined;
  listScheduledTasks: (
    filter?: ListScheduledTasksFilter
  ) => ScheduledAgentTaskRow[];
  updateScheduledTask: (
    id: string,
    input: Partial<ScheduledAgentTaskInput>
  ) => ScheduledAgentTaskRow | undefined;
}

export interface CreateScheduledTasksServiceOptions {
  now?: () => Date;
  repository: ScheduledTasksRepository;
  scheduler: ScheduledTaskScheduler;
}

let defaultService:
  | (ScheduledTasksService & { start: () => void; stop: () => void })
  | undefined;

const THINKING_LEVELS = new Set<ScheduledTaskThinkingLevel>([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh"
]);

export function createScheduledTasksService(
  options: CreateScheduledTasksServiceOptions
): ScheduledTasksService {
  const now = options.now ?? (() => new Date());

  return {
    createScheduledTask: (input) => {
      const validated = validateInput(input);
      const createdAt = now().toISOString();
      const task = options.repository.createScheduledTask({
        ...validated,
        createdAt,
        enabled: input.enabled ?? true,
        id: `scheduled_${randomUUID()}`,
        lastRunAt: null,
        nextRunAt: getNextRunAt({
          expression: validated.cronExpression,
          now: new Date(createdAt),
          timezone: validated.timezone
        }),
        updatedAt: createdAt
      });
      options.scheduler.reloadTask(task.id);
      return task;
    },
    deleteScheduledTask: (id) => {
      const existing = options.repository.findScheduledTaskById(id);
      if (!existing) return false;
      options.repository.deleteScheduledTaskById(id);
      options.scheduler.reloadTask(id);
      return true;
    },
    disableScheduledTask: (id) => updateEnabled(options, id, false),
    enableScheduledTask: (id) => updateEnabled(options, id, true),
    findScheduledTask: (id) => options.repository.findScheduledTaskById(id),
    listScheduledTasks: (filter) => options.repository.listScheduledTasks(filter),
    updateScheduledTask: (id, input) => {
      const existing = options.repository.findScheduledTaskById(id);
      if (!existing) return undefined;
      const mergedInput = validateInput({
        allowConcurrentRuns:
          input.allowConcurrentRuns ?? existing.allowConcurrentRuns,
        cronExpression: input.cronExpression ?? existing.cronExpression,
        enabled: input.enabled ?? existing.enabled,
        modelId: input.modelId ?? existing.modelId,
        name: input.name ?? existing.name,
        prompt: input.prompt ?? existing.prompt,
        provider: input.provider ?? existing.provider,
        thinkingLevel: input.thinkingLevel ?? existing.thinkingLevel,
        timezone: input.timezone ?? existing.timezone,
        workspacePath: input.workspacePath ?? existing.workspacePath
      });
      const updatedAt = now().toISOString();
      const updated = options.repository.updateScheduledTask(id, {
        ...mergedInput,
        enabled: input.enabled ?? existing.enabled,
        nextRunAt: getNextRunAt({
          expression: mergedInput.cronExpression,
          now: new Date(updatedAt),
          timezone: mergedInput.timezone
        }),
        updatedAt
      });
      options.scheduler.reloadTask(id);
      return updated;
    }
  };
}

export function getDefaultScheduledTasksService(options: {
  agentsService: Pick<AgentsService, "startAgent">;
}): ScheduledTasksService & { start: () => void; stop: () => void } {
  if (!defaultService) {
    loadApiEnv();
    const database = createDatabase(process.env.SQLITE_DB_PATH ?? DB_FILE);
    migrateDatabase(database.sqlite);
    const repository = createSqliteScheduledTasksRepository(database);
    const workspaceRepository = createSqliteWorkspaceRepository(database);
    const scheduler = createScheduledTaskScheduler({
      agentsService: options.agentsService,
      repository,
      workspaceRepository
    });
    const service = createScheduledTasksService({ repository, scheduler });

    defaultService = {
      ...service,
      start: scheduler.start,
      stop: scheduler.stop
    };
  }

  return defaultService;
}

function updateEnabled(
  options: CreateScheduledTasksServiceOptions,
  id: string,
  enabled: boolean
): ScheduledAgentTaskRow | undefined {
  const existing = options.repository.findScheduledTaskById(id);
  if (!existing) return undefined;
  const updated = options.repository.updateScheduledTask(id, {
    enabled,
    updatedAt: (options.now ?? (() => new Date()))().toISOString()
  });
  options.scheduler.reloadTask(id);
  return updated;
}

function validateInput(
  input: ScheduledAgentTaskInput
): Required<ScheduledAgentTaskInput> {
  assertNonEmpty("name", input.name);
  assertNonEmpty("prompt", input.prompt);
  assertNonEmpty("provider", input.provider);
  assertNonEmpty("modelId", input.modelId);
  assertNonEmpty("workspacePath", input.workspacePath);
  assertNonEmpty("timezone", input.timezone);

  if (!THINKING_LEVELS.has(input.thinkingLevel)) {
    throw new Error("Invalid thinking level");
  }

  if (!isValidCronExpression(input.cronExpression)) {
    throw new Error("Invalid cron expression");
  }

  return {
    ...input,
    allowConcurrentRuns: input.allowConcurrentRuns,
    enabled: input.enabled ?? true
  };
}

function assertNonEmpty(name: string, value: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
}
