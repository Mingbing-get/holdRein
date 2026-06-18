import { randomUUID } from "node:crypto";

import type { AgentEventBus } from "./agent-event-bus";
import type { StoredAgentMessage } from "./agent-types";

export async function appendVisibleCustomMessage(input: {
  agentId: string;
  content: string;
  customType: string;
  details?: unknown;
  eventBus: AgentEventBus;
  session: {
    appendCustomMessageEntry: (
      customType: string,
      content: string,
      display: boolean,
      details?: unknown
    ) => Promise<unknown>;
  };
}) {
  await input.session.appendCustomMessageEntry(
    input.customType,
    input.content,
    true,
    input.details
  );
  input.eventBus.emit({
    agentId: input.agentId,
    payload: {
      message: {
        content: input.content,
        customType: input.customType,
        ...(input.details === undefined ? {} : { details: input.details }),
        display: true,
        id: `message_${randomUUID()}`,
        role: "custom",
        timestamp: Date.now()
      } satisfies StoredAgentMessage
    },
    type: "message_start"
  });
}
