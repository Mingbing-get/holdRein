import type {
  AgentEventEnvelope,
  AgentTaskState,
  PendingApproval
} from "../agent-message-types";
import { reduceAgentMessages } from "../collection";
import type { WebPlugin } from "@hold-rein/plugin-web";

export type AgentTaskAction =
  | { prompt: string; type: "prompt_submitted" }
  | { approvalId: string; type: "approval_decided" }
  | { event: AgentEventEnvelope; type: "event_received" }
  | { messages: WebPlugin.AgentMessage[]; type: "history_loaded" }
  | { approval: PendingApproval; type: "local_approval_requested" }
  | { message: string; type: "subscription_failed" };

export function createInitialAgentTaskState(taskId: string): AgentTaskState {
  return {
    error: null,
    lastSequence: 0,
    messages: [],
    pendingApprovals: [],
    status: "idle",
    taskId
  };
}

export function reduceAgentTaskState(
  state: AgentTaskState,
  action: AgentTaskAction
): AgentTaskState {
  if (action.type === "prompt_submitted") {
    return {
      ...state,
      messages: [
        ...state.messages,
        {
          content: [{ text: action.prompt, type: "text" }],
          id: `prompt-${state.messages.length}`,
          role: "user",
          timestamp: Date.now()
        }
      ],
      status: "running"
    };
  }
  if (action.type === "history_loaded") {
    return { ...state, messages: action.messages };
  }
  if (action.type === "subscription_failed") {
    return { ...state, error: action.message, status: "error" };
  }
  if (action.type === "approval_decided") {
    return {
      ...state,
      pendingApprovals: state.pendingApprovals.filter(
        (approval) => approval.approvalId !== action.approvalId
      )
    };
  }
  if (action.type === "local_approval_requested") {
    if (
      state.pendingApprovals.some(
        (approval) => approval.approvalId === action.approval.approvalId
      )
    ) {
      return state;
    }
    return {
      ...state,
      pendingApprovals: [...state.pendingApprovals, action.approval]
    };
  }

  const next = {
    ...state,
    lastSequence: Math.max(state.lastSequence, action.event.sequence)
  };
  const payload = getRecord(action.event.payload);

  if (action.event.type === "approval_requested") {
    const approval = getPendingApproval(payload);
    if (
      !approval ||
      next.pendingApprovals.some(
        (candidate) => candidate.approvalId === approval.approvalId
      )
    ) {
      return next;
    }
    return {
      ...next,
      pendingApprovals: [...next.pendingApprovals, approval]
    };
  }
  if (
    action.event.type === "message_start" ||
    action.event.type === "message_delta" ||
    action.event.type === "message_end"
  ) {
    return {
      ...next,
      messages: reduceAgentMessages(state.messages, action.event)
    };
  }
  if (action.event.type === "agent_error") {
    const message = typeof payload?.message === "string" ? payload.message : "Agent run failed";
    return { ...next, error: message, status: "error" };
  }
  if (action.event.type === "task_end") {
    return { ...next, status: "completed" };
  }
  return next;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getPendingApproval(
  value: Record<string, unknown> | undefined
): PendingApproval | undefined {
  if (
    typeof value?.agentId !== "string" ||
    typeof value.approvalId !== "string" ||
    (value.status !== undefined && value.status !== "pending") ||
    (value.title !== undefined && typeof value.title !== "string")
  ) {
    return undefined;
  }
  const tool = getRecord(value.tool);
  if (
    typeof tool?.name !== "string" ||
    typeof tool.toolCallId !== "string" ||
    (tool.description !== undefined && typeof tool.description !== "string") ||
    (tool.label !== undefined && typeof tool.label !== "string")
  ) {
    return undefined;
  }
  return {
    agentId: value.agentId,
    approvalId: value.approvalId,
    ...(value.title === undefined ? {} : { title: value.title }),
    tool: {
      ...(tool.description === undefined ? {} : { description: tool.description }),
      input: tool.input,
      ...(tool.label === undefined ? {} : { label: tool.label }),
      name: tool.name,
      toolCallId: tool.toolCallId
    }
  };
}
