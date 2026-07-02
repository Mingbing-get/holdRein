import type { ThinkingLevel } from "../agent-messages/agent-message-types";

export type ScheduledTaskThinkingLevel = ThinkingLevel;

export interface ScheduledTaskInput {
  allowConcurrentRuns: boolean;
  cronExpression: string;
  enabled?: boolean;
  modelId: string;
  name: string;
  prompt: string;
  provider: string;
  thinkingLevel: ScheduledTaskThinkingLevel;
  timezone: string;
  workspacePath: string;
}

export interface ScheduledTask extends ScheduledTaskInput {
  createdAt: string;
  enabled: boolean;
  id: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  updatedAt: string;
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}
