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

export interface HostApiAgentStartResult {
  readonly agentId: string;
  readonly sessionId: string;
  readonly status: "running";
  readonly task: unknown;
  readonly workspace: unknown;
}

export interface HostApiAgentClient {
  readonly start: (
    input: HostApiAgentStartInput
  ) => Promise<HostApiResult<HostApiAgentStartResult>>;
}

export function createAgentApi(request: HostApiRequest): HostApiAgentClient {
  return {
    start(input) {
      return request<HostApiAgentStartResult>({
        body: input,
        method: "POST",
        path: "/api/v1/agents/start"
      });
    }
  };
}
