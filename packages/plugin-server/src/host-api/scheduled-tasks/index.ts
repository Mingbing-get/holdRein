import type { HostApiThinkingLevel } from "../agent";
import type { HostApiRequest, HostApiResult } from "..";

export type HostApiScheduledTaskThinkingLevel = HostApiThinkingLevel;

export interface HostApiScheduledTaskInput {
  readonly allowConcurrentRuns: boolean;
  readonly cronExpression: string;
  readonly enabled?: boolean;
  readonly modelId: string;
  readonly name: string;
  readonly prompt: string;
  readonly provider: string;
  readonly thinkingLevel: HostApiScheduledTaskThinkingLevel;
  readonly timezone: string;
  readonly workspacePath: string;
}

export interface HostApiScheduledTask extends HostApiScheduledTaskInput {
  readonly createdAt: string;
  readonly enabled: boolean;
  readonly id: string;
  readonly lastRunAt: string | null;
  readonly nextRunAt: string | null;
  readonly updatedAt: string;
}

export interface HostApiScheduledTaskIdInput {
  readonly id: string;
}

export interface HostApiListScheduledTasksInput {
  readonly workspacePath?: string;
}

export type HostApiUpdateScheduledTaskInput = HostApiScheduledTaskIdInput &
  Partial<HostApiScheduledTaskInput>;

export interface HostApiDeletedScheduledTaskResult {
  readonly id: string;
}

export interface HostApiScheduledTasksClient {
  readonly create: (
    input: HostApiScheduledTaskInput
  ) => Promise<HostApiResult<HostApiScheduledTask>>;
  readonly delete: (
    input: HostApiScheduledTaskIdInput
  ) => Promise<HostApiResult<HostApiDeletedScheduledTaskResult>>;
  readonly disable: (
    input: HostApiScheduledTaskIdInput
  ) => Promise<HostApiResult<HostApiScheduledTask>>;
  readonly enable: (
    input: HostApiScheduledTaskIdInput
  ) => Promise<HostApiResult<HostApiScheduledTask>>;
  readonly get: (
    input: HostApiScheduledTaskIdInput
  ) => Promise<HostApiResult<HostApiScheduledTask>>;
  readonly list: (
    input?: HostApiListScheduledTasksInput
  ) => Promise<HostApiResult<readonly HostApiScheduledTask[]>>;
  readonly update: (
    input: HostApiUpdateScheduledTaskInput
  ) => Promise<HostApiResult<HostApiScheduledTask>>;
}

export function createScheduledTasksApi(
  request: HostApiRequest
): HostApiScheduledTasksClient {
  return {
    create(input) {
      return request<HostApiScheduledTask>({
        body: input,
        method: "POST",
        path: "/api/v1/scheduled-tasks"
      });
    },
    delete(input) {
      return request<HostApiDeletedScheduledTaskResult>({
        method: "DELETE",
        path: getScheduledTaskPath(input.id)
      });
    },
    disable(input) {
      return request<HostApiScheduledTask>({
        method: "POST",
        path: `${getScheduledTaskPath(input.id)}/disable`
      });
    },
    enable(input) {
      return request<HostApiScheduledTask>({
        method: "POST",
        path: `${getScheduledTaskPath(input.id)}/enable`
      });
    },
    get(input) {
      return request<HostApiScheduledTask>({
        path: getScheduledTaskPath(input.id)
      });
    },
    list(input = {}) {
      return request<readonly HostApiScheduledTask[]>({
        path: "/api/v1/scheduled-tasks",
        ...(input.workspacePath
          ? { query: { workspacePath: input.workspacePath } }
          : {})
      });
    },
    update(input) {
      const { id, ...body } = input;

      return request<HostApiScheduledTask>({
        body,
        method: "PATCH",
        path: getScheduledTaskPath(id)
      });
    }
  };
}

function getScheduledTaskPath(id: string): string {
  return `/api/v1/scheduled-tasks/${encodeURIComponent(id)}`;
}
