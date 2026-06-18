import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";
import type { TaskRow, WorkspaceRow } from "../../db";

export interface StartAgentInput {
  modelId: string;
  prompt: string;
  provider: string;
  workspacePath: string;
}

export interface RunAgentInput extends StartAgentInput {
  session?: AgentSessionMetadata;
  taskId: string;
}

export interface AgentSessionMetadata {
  createdAt: string;
  id: string;
  path: string;
}

export interface AgentRunResult {
  agentId: string;
  session: AgentSessionMetadata;
  status: "running";
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

export interface StartAgentResult {
  agentId: string;
  sessionId: string;
  status: "running";
  task: TaskRow;
  workspace: WorkspaceRow;
}

export interface TaskTitleResult {
  id: string;
  title: string;
}

export interface AgentEventEnvelope {
  agentId: string;
  payload?: unknown;
  sequence: number;
  timestamp: string;
  type: string;
}

export interface TaskSubagentHistory {
  agentId: string;
  messages: StoredAgentMessage[];
  parentAgentId: string;
  status: "running" | "completed";
}

export interface TaskMessageHistory {
  messages: StoredAgentMessage[];
  subagents: TaskSubagentHistory[];
}

export interface AgentEventSubscription {
  unsubscribe: () => void;
}

export interface SubscribeAgentEventsInput {
  afterSequence?: number;
  agentId: string;
}

export interface ApprovalDecisionInput {
  agentId: string;
  approvalId: string;
  approved: boolean;
  reason?: string;
}

export interface ApprovalDecisionResult extends ApprovalDecisionInput {}

export interface ApprovalDecision {
  approved: boolean;
  reason?: string;
}

export interface ToolApprovalRequest {
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

export type HarnessEvent = AgentHarnessEvent;

export interface StoredTextContent {
  text: string;
  textSignature?: string;
  type: "text";
}

export interface StoredThinkingContent {
  redacted?: boolean;
  thinking: string;
  thinkingSignature?: string;
  type: "thinking";
}

export interface StoredImageContent {
  data: string;
  mimeType: string;
  type: "image";
}

export interface StoredToolCall {
  arguments: Record<string, unknown>;
  id: string;
  name: string;
  thoughtSignature?: string;
  type: "toolCall";
}

export type StoredUserContent = StoredTextContent | StoredImageContent;
export type StoredAssistantContent =
  | StoredTextContent
  | StoredThinkingContent
  | StoredToolCall;

interface StoredMessageBase {
  id: string;
  timestamp: number;
}

export interface StoredUserMessage extends StoredMessageBase {
  content: string | StoredUserContent[];
  role: "user";
}

export interface StoredAssistantMessage extends StoredMessageBase {
  api: string;
  content: StoredAssistantContent[];
  errorMessage?: string;
  model: string;
  provider: string;
  role: "assistant";
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
}

export interface StoredToolResultMessage extends StoredMessageBase {
  content: StoredUserContent[];
  isError: boolean;
  role: "toolResult";
  toolCallId: string;
  toolName: string;
}

export interface StoredBashExecutionMessage extends StoredMessageBase {
  cancelled: boolean;
  command: string;
  excludeFromContext?: boolean;
  exitCode?: number;
  fullOutputPath?: string;
  output: string;
  role: "bashExecution";
  truncated: boolean;
}

export interface StoredCustomMessage extends StoredMessageBase {
  content: string | StoredUserContent[];
  customType: string;
  details?: unknown;
  display: boolean;
  role: "custom";
}

export interface StoredBranchSummaryMessage extends StoredMessageBase {
  fromId: string;
  role: "branchSummary";
  summary: string;
}

export interface StoredCompactionSummaryMessage extends StoredMessageBase {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
}

export type StoredAgentMessage =
  | StoredUserMessage
  | StoredAssistantMessage
  | StoredToolResultMessage
  | StoredBashExecutionMessage
  | StoredCustomMessage
  | StoredBranchSummaryMessage
  | StoredCompactionSummaryMessage;
