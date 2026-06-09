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
  id: string;
  name: string;
  thoughtSignature?: string;
  type: "toolCall";
}

interface AgentMessageBase {
  id: string;
  timestamp: number;
}

export interface UserMessage extends AgentMessageBase {
  content: string | (TextContent | ImageContent)[];
  role: "user";
}

export interface AssistantMessage extends AgentMessageBase {
  api: string;
  content: (TextContent | ThinkingContent | ToolCall)[];
  errorMessage?: string;
  model: string;
  provider: string;
  role: "assistant";
  stopReason: "stop" | "length" | "toolUse" | "error" | "aborted";
}

export interface ToolResultMessage extends AgentMessageBase {
  content: (TextContent | ImageContent)[];
  isError: boolean;
  role: "toolResult";
  toolCallId: string;
  toolName: string;
}

export interface CustomMessage extends AgentMessageBase {
  content: string | (TextContent | ImageContent)[];
  customType: string;
  display: boolean;
  role: "custom";
}

export interface BashExecutionMessage extends AgentMessageBase {
  cancelled: boolean;
  command: string;
  exitCode?: number;
  output: string;
  role: "bashExecution";
  truncated: boolean;
}

export interface SummaryMessage extends AgentMessageBase {
  role: "branchSummary" | "compactionSummary";
  summary: string;
}

export type AgentMessage =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | CustomMessage
  | BashExecutionMessage
  | SummaryMessage;

export interface AgentEventEnvelope {
  agentId: string;
  payload?: unknown;
  sequence: number;
  timestamp: string;
  type: string;
}

export interface AgentRun {
  agentId: string;
  sessionId: string;
  status: "running";
}

export interface AgentTaskState {
  error: string | null;
  lastSequence: number;
  messages: AgentMessage[];
  runs: AgentRun[];
  status: "idle" | "running" | "completed" | "error";
  taskId: string;
}

export interface StartTaskInput {
  modelId: string;
  prompt: string;
  provider: string;
  workspacePath: string;
}

export interface StartedWorkspace {
  id: string;
  name: string;
  path: string;
}

export interface StartedTask {
  id: string;
  initialUserMessage: string;
  lastContinuedAt: string;
  lastModelId?: string | null;
  lastModelName: string;
  lastModelProvider: string;
  lastModelProviderSource: "built_in" | "custom";
  title: string;
  workspaceId: string;
}

export interface StartTaskResult extends AgentRun {
  task: StartedTask;
  workspace: StartedWorkspace;
}

export interface TaskTitleResult {
  id: string;
  title: string;
}
