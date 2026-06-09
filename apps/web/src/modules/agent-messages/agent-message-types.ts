export type AgentMessageKind =
  | "approval"
  | "assistant"
  | "error"
  | "fallback"
  | "thinking"
  | "tool"
  | "user";

export interface AgentMessage {
  content: string;
  eventType?: string;
  id: string;
  kind: AgentMessageKind;
  payload?: unknown;
}

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
  activeMessageId: string | null;
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
