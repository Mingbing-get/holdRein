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
