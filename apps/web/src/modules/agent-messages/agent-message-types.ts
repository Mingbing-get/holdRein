import type { WebPlugin } from "@hold-rein/plugin-web";

export interface TextContent {
  text: string;
  textSignature?: string;
  type: "text";
}

export interface ThinkingContent {
  redacted?: boolean;
  thinking: string;
  thinkingSignature?: string;
  type: "thinking";
}

export interface ImageContent {
  data: string;
  mimeType: string;
  type: "image";
}

export interface ToolCall {
  arguments: Record<string, unknown>;
  argumentsParsed?: boolean;
  argumentsText?: string;
  id: string;
  name: string;
  thoughtSignature?: string;
  type: "toolCall";
}

export interface AgentEventEnvelope {
  agentId: string;
  payload?: unknown;
  sequence: number;
  timestamp: string;
  type: string;
}

export interface PendingApproval {
  agentId: string;
  approvalId: string;
  title?: string;
  tool: {
    description?: string;
    input: unknown;
    label?: string;
    name: string;
    toolCallId: string;
  };
}

export type ThinkingLevel =
  | "off"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type ApprovalPolicy = "approval" | "run_all";

export interface ApprovalDecisionInput {
  agentId: string;
  approvalId: string;
  approved: boolean;
  reason?: string;
}
 
export interface AgentTaskState {
  error: string | null;
  lastSequence: number;
  messages: WebPlugin.AgentMessage[];
  pendingApprovals: PendingApproval[];
  status: "idle" | "running" | "completed" | "error";
  taskId: string;
}

export interface TaskSubagentHistory {
  agentId: string;
  agentName: string;
  messages: WebPlugin.AgentMessage[];
  parentAgentId: string;
  status: "running" | "completed" | "interrupted";
}

export interface TaskMessageHistory {
  agentId?: string;
  messages: WebPlugin.AgentMessage[];
  subagents: TaskSubagentHistory[];
}

export interface SubagentState {
  agentName: string;
  messages: WebPlugin.AgentMessage[];
  parentAgentId: string;
  status: "running" | "completed" | "interrupted";
  taskId: string;
}

export type SubagentStatesById = Record<string, SubagentState>;

export interface StartTaskInput {
  approvalPolicy?: ApprovalPolicy;
  modelId: string;
  prompt: string;
  provider: string;
  runtimeContributions?: WebPlugin.BrowserRuntimeContributions;
  thinkingLevel?: ThinkingLevel;
  workspacePath: string;
}

export interface ContinueTaskInput {
  approvalPolicy?: ApprovalPolicy;
  modelId: string;
  prompt: string;
  provider: string;
  runtimeContributions?: WebPlugin.BrowserRuntimeContributions;
  thinkingLevel?: ThinkingLevel;
}

export interface BrowserToolResultInput {
  agentId: string;
  content: string | WebPlugin.TextContent[];
  isError?: boolean;
  toolCallId: string;
}

export interface StartedWorkspace {
  id: string;
  name: string;
  path: string;
}

export interface StartedTask {
  id: string;
  initialUserMessage: string;
  approvalPolicy: ApprovalPolicy;
  lastContinuedAt: string;
  lastModelId?: string | null;
  lastModelName: string;
  lastModelProvider: string;
  lastModelProviderSource: "built_in" | "custom";
  status: "running" | "completed" | "error";
  thinkingLevel: ThinkingLevel;
  title: string;
  workspaceId: string;
}

export interface StartTaskResult {
  agentId: string;
  sessionId: string;
  status: "running";
  task: StartedTask;
  workspace: StartedWorkspace;
}

export interface TaskTitleResult {
  id: string;
  title: string;
}

export type InterruptTaskResult =
  | {
      agentId: string;
      status: "interrupted";
      taskId: string;
    }
  | {
      status: "not_found" | "not_running";
      taskId: string;
    };
