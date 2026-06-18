import {
  getCalledSubagentIds,
  reduceAgentMessages
} from "./agent-message-collection";
import type {
  AgentEventEnvelope,
  SubagentMessagesById
} from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function discoverSubagents(
  current: SubagentMessagesById,
  messages: WebPlugin.AgentMessage[]
): SubagentMessagesById {
  const missingAgentIds = getCalledSubagentIds(messages).filter(
    (agentId) => !(agentId in current)
  );
  if (!missingAgentIds.length) return current;

  const next = { ...current };
  for (const agentId of missingAgentIds) next[agentId] = [];
  return next;
}

export function reduceSubagentEvent(
  current: SubagentMessagesById,
  agentId: string,
  event: AgentEventEnvelope
): SubagentMessagesById {
  const messages = reduceAgentMessages(current[agentId] ?? [], event);
  return discoverSubagents({ ...current, [agentId]: messages }, messages);
}
