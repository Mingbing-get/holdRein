export type ScheduledTaskThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export interface ScheduledAgentTaskInput {
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
