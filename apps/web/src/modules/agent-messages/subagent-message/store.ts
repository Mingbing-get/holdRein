import {
  getCalledSubagentIds,
  reduceAgentMessages
} from "../collection";
import type {
  AgentEventEnvelope,
  SubagentStatesById,
  TaskSubagentHistory
} from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function initializeSubagentsFromHistory(
  current: SubagentStatesById,
  subagents: TaskSubagentHistory[],
  taskId: string
): SubagentStatesById {
  if (!subagents.length) return current;

  const next = { ...current };
  for (const subagent of subagents) {
    next[subagent.agentId] = {
      agentName: subagent.agentName,
      messages: subagent.messages,
      parentAgentId: subagent.parentAgentId,
      status: subagent.status,
      taskId
    };
  }
  return next;
}

export function discoverSubagents(
  current: SubagentStatesById,
  messages: WebPlugin.AgentMessage[],
  taskId: string
): SubagentStatesById {
  const missingAgentIds = getCalledSubagentIds(messages).filter(
    (agentId) => !(agentId in current)
  );
  if (!missingAgentIds.length) return current;

  const next = { ...current };
  for (const agentId of missingAgentIds) {
    next[agentId] = {
      agentName: "subagent",
      messages: [],
      parentAgentId: "",
      status: "running",
      taskId
    };
  }
  return next;
}

export function reduceSubagentEvent(
  current: SubagentStatesById,
  agentId: string,
  event: AgentEventEnvelope
): SubagentStatesById {
  const existing = current[agentId] ?? {
    agentName: "subagent",
    messages: [],
    parentAgentId: "",
    status: "running" as const,
    taskId: ""
  };
  const messages = reduceAgentMessages(existing.messages, event);
  const nextState = {
    ...existing,
    messages,
    status: event.type === "agent_end" ? "completed" as const : existing.status
  };

  return discoverSubagents(
    { ...current, [agentId]: nextState },
    messages,
    existing.taskId
  );
}

export function reduceSubagentResumeEvent(
  current: SubagentStatesById,
  event: AgentEventEnvelope,
  taskId: string
): SubagentStatesById {
  if (event.type !== "subagent_resumed") return current;
  const payload = getRecord(event.payload);
  if (typeof payload?.agentId !== "string") return current;
  const existing = current[payload.agentId];
  const messages = [
    ...(existing?.messages ?? []),
    ...getPayloadMessages(payload)
  ];
  const resolvedTaskId =
    typeof payload.taskId === "string"
      ? payload.taskId
      : existing?.taskId ?? taskId;
  const nextState = {
    agentName:
      typeof payload.agentName === "string"
        ? payload.agentName
        : existing?.agentName ?? "subagent",
    messages,
    parentAgentId:
      typeof payload.parentAgentId === "string"
        ? payload.parentAgentId
        : existing?.parentAgentId ?? "",
    status: "running" as const,
    taskId: resolvedTaskId
  };

  return discoverSubagents(
    { ...current, [payload.agentId]: nextState },
    messages,
    resolvedTaskId
  );
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function getPayloadMessages(
  payload: Record<string, unknown>
): WebPlugin.AgentMessage[] {
  if (Array.isArray(payload.messages)) {
    return payload.messages.filter(isAgentMessage);
  }
  return isAgentMessage(payload.message) ? [payload.message] : [];
}

function isAgentMessage(value: unknown): value is WebPlugin.AgentMessage {
  const message = getRecord(value);
  return typeof message?.id === "string" && typeof message.role === "string";
}
