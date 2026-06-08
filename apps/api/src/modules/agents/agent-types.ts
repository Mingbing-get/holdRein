import type { AgentHarnessEvent } from "@earendil-works/pi-agent-core";

export interface StartAgentInput {
  modelId: string;
  prompt: string;
  provider: string;
  workspacePath: string;
}

export interface StartAgentResult {
  agentId: string;
  sessionId: string;
  status: "running";
}

export interface AgentEventEnvelope {
  agentId: string;
  payload?: unknown;
  sequence: number;
  timestamp: string;
  type: string;
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
}

export interface ApprovalDecisionResult extends ApprovalDecisionInput {}

export interface ShellCommandApprovalRequest {
  agentId: string;
  approvalId: string;
  command: string;
  cwd: string;
  risk: ShellCommandRisk;
}

export type ShellCommandRisk = "safe" | "writes" | "dangerous";

export type HarnessEvent = AgentHarnessEvent;
