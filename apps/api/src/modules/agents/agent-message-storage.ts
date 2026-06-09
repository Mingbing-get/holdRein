import type { AgentMessage } from "@earendil-works/pi-agent-core";

import type { StoredAgentMessage } from "./agent-types";

const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0
};

export function toStoredAgentMessage(
  id: string,
  message: AgentMessage
): StoredAgentMessage {
  const stored = { ...message, id } as StoredAgentMessage & Record<string, unknown>;

  delete stored.details;
  delete stored.diagnostics;
  delete stored.responseId;
  delete stored.responseModel;
  delete stored.usage;

  return stored;
}

export function restoreStoredAgentMessage(
  message: StoredAgentMessage
): AgentMessage {
  const restored = { ...message } as Record<string, unknown>;
  delete restored.id;

  if (message.role === "assistant") {
    return {
      ...restored,
      usage: EMPTY_USAGE
    } as AgentMessage;
  }

  return restored as unknown as AgentMessage;
}
