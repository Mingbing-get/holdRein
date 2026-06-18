import type { StoredAgentMessage } from "../agent-types";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export function toStoredAgentMessage(
  id: string,
  message: AgentMessage
): StoredAgentMessage {
  const stored = { ...message, id } as StoredAgentMessage & Record<string, unknown>;

  if (stored.role !== "custom") {
    delete stored.details;
  }
  delete stored.diagnostics;
  delete stored.responseId;
  delete stored.responseModel;
  delete stored.usage;

  return stored;
}
