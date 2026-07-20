import type { HostApiRequest, HostApiResult } from "..";

export interface HostApiImageContent {
  readonly data: string;
  readonly mimeType: string;
  readonly type: "image";
}

export type HostApiApprovalPolicy = "approval" | "run_all";

export type HostApiThinkingLevel =
  | "high"
  | "low"
  | "medium"
  | "minimal"
  | "off"
  | "xhigh";

export interface HostApiAgentStartInput {
  readonly approvalPolicy?: HostApiApprovalPolicy;
  readonly images?: readonly HostApiImageContent[];
  readonly modelId: string;
  readonly prompt: string;
  readonly provider: string;
  readonly thinkingLevel?: HostApiThinkingLevel;
  readonly workspacePath: string;
}

interface HostApiAgentContinueBaseInput {
  readonly approvalPolicy?: HostApiApprovalPolicy;
  readonly images?: readonly HostApiImageContent[];
  readonly prompt: string;
  readonly runtimeContributions?: HostApiBrowserRuntimeContributions;
  readonly taskId: string;
  readonly thinkingLevel?: HostApiThinkingLevel;
}

export type HostApiAgentContinueInput = HostApiAgentContinueBaseInput &
  (
    | {
        readonly modelId: string;
        readonly provider: string;
      }
    | {
        readonly modelId?: never;
        readonly provider?: never;
      }
  );

export interface HostApiAgentTaskInput {
  readonly taskId: string;
}

export interface HostApiAgentRenameTaskInput extends HostApiAgentTaskInput {
  readonly title: string;
}

export interface HostApiAgentListSkillsInput {
  readonly workspacePath: string;
}

export interface HostApiBrowserRuntimeContributions {
  readonly skills?: readonly HostApiBrowserRuntimeSkill[];
  readonly systemPrompts?: readonly string[];
  readonly tools?: readonly HostApiBrowserRuntimeToolSchema[];
}

export interface HostApiBrowserRuntimeSkill {
  readonly content: string;
  readonly description?: string;
  readonly name: string;
  readonly references?: readonly HostApiBrowserRuntimeSkillReference[];
}

export interface HostApiBrowserRuntimeSkillReference {
  readonly content: string;
  readonly path: string;
}

export interface HostApiBrowserRuntimeToolSchema {
  readonly description?: string;
  readonly inputSchema: unknown;
  readonly name: string;
}

export interface HostApiAgentStartResult {
  readonly agentId: string;
  readonly sessionId: string;
  readonly status: "running";
  readonly task: unknown;
  readonly workspace: unknown;
}

export interface HostApiAgentTaskTitleResult {
  readonly id: string;
  readonly title: string;
}

export interface HostApiAgentDeletedTaskResult {
  readonly taskId: string;
}

export type HostApiAgentInterruptTaskResult =
  | {
      readonly agentId: string;
      readonly status: "interrupted";
      readonly taskId: string;
    }
  | {
      readonly status: "not_found" | "not_running";
      readonly taskId: string;
    };

export interface HostApiAgentTaskMessageHistory {
  readonly messages: readonly unknown[];
  readonly subagents: readonly HostApiAgentTaskSubagentHistory[];
}

export interface HostApiAgentTaskSubagentHistory {
  readonly agentId: string;
  readonly agentName: string;
  readonly messages: readonly unknown[];
  readonly parentAgentId: string;
  readonly status: "completed" | "interrupted" | "running";
}

export interface HostApiAgentListSkillsResult {
  readonly skills: readonly HostApiAgentSkillSummary[];
}

export interface HostApiAgentSkillSummary {
  readonly name: string;
  readonly path: string;
}

export interface HostApiAgentClient {
  readonly continueTask: (
    input: HostApiAgentContinueInput
  ) => Promise<HostApiResult<HostApiAgentStartResult>>;
  readonly deleteTask: (
    input: HostApiAgentTaskInput
  ) => Promise<HostApiResult<HostApiAgentDeletedTaskResult>>;
  readonly interruptTask: (
    input: HostApiAgentTaskInput
  ) => Promise<HostApiResult<HostApiAgentInterruptTaskResult>>;
  readonly listSkills: (
    input: HostApiAgentListSkillsInput
  ) => Promise<HostApiResult<HostApiAgentListSkillsResult>>;
  readonly listTaskMessages: (
    input: HostApiAgentTaskInput
  ) => Promise<HostApiResult<HostApiAgentTaskMessageHistory>>;
  readonly renameTask: (
    input: HostApiAgentRenameTaskInput
  ) => Promise<HostApiResult<HostApiAgentTaskTitleResult>>;
  readonly start: (
    input: HostApiAgentStartInput
  ) => Promise<HostApiResult<HostApiAgentStartResult>>;
}

export function createAgentApi(request: HostApiRequest): HostApiAgentClient {
  return {
    continueTask(input) {
      const { taskId, ...body } = input;

      return request<HostApiAgentStartResult>({
        body,
        method: "POST",
        path: `${getTaskPath(taskId)}/continue`
      });
    },
    deleteTask(input) {
      return request<HostApiAgentDeletedTaskResult>({
        method: "DELETE",
        path: getTaskPath(input.taskId)
      });
    },
    interruptTask(input) {
      return request<HostApiAgentInterruptTaskResult>({
        method: "POST",
        path: `${getTaskPath(input.taskId)}/interrupt`
      });
    },
    listSkills(input) {
      return request<HostApiAgentListSkillsResult>({
        path: "/api/v1/agents/skills",
        query: { workspacePath: input.workspacePath }
      });
    },
    listTaskMessages(input) {
      return request<HostApiAgentTaskMessageHistory>({
        path: `${getTaskPath(input.taskId)}/messages`
      });
    },
    renameTask(input) {
      return request<HostApiAgentTaskTitleResult>({
        body: { title: input.title },
        method: "PATCH",
        path: getTaskPath(input.taskId)
      });
    },
    start(input) {
      return request<HostApiAgentStartResult>({
        body: input,
        method: "POST",
        path: "/api/v1/agents/start"
      });
    }
  };
}

function getTaskPath(taskId: string): string {
  return `/api/v1/agents/tasks/${encodeURIComponent(taskId)}`;
}
