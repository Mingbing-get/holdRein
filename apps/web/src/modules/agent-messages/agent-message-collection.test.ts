import { describe, expect, it } from "vitest";

import {
  getCalledSubagentId,
  getCalledSubagentIds,
  reduceAgentMessages
} from "./agent-message-collection";
import type { AgentEventEnvelope } from "./agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

const assistant: WebPlugin.AssistantMessage = {
  api: "openai-responses",
  content: [],
  id: "message-1",
  model: "gpt-4.1",
  provider: "openai",
  role: "assistant",
  stopReason: "stop",
  timestamp: 1
};

describe("agent message collection", () => {
  it("reduces streaming message events without task state", () => {
    const finalMessage: WebPlugin.AssistantMessage = {
      ...assistant,
      content: [{ text: "Final answer", type: "text" }]
    };
    const messages = [
      event(1, "message_start", { message: assistant }),
      event(2, "message_delta", {
        delta: { contentIndex: 0, type: "text_start" },
        messageId: assistant.id
      }),
      event(3, "message_delta", {
        delta: { contentIndex: 0, delta: "Draft", type: "text_delta" },
        messageId: assistant.id
      }),
      event(4, "message_end", { message: finalMessage })
    ].reduce(reduceAgentMessages, [] as WebPlugin.AgentMessage[]);

    expect(messages).toEqual([finalMessage]);
  });

  it("extracts child identifiers only from valid callsubagent messages", () => {
    const callMessage: WebPlugin.CustomMessage = {
      content: "Subagent is running",
      customType: "callsubagent",
      details: { agentId: "agent-child" },
      display: true,
      id: "message-child",
      role: "custom",
      timestamp: 1
    };
    const ordinaryMessage: WebPlugin.CustomMessage = {
      ...callMessage,
      customType: "notice",
      id: "message-notice"
    };
    const malformedMessage: WebPlugin.CustomMessage = {
      ...callMessage,
      details: { agentId: 42 },
      id: "message-malformed"
    };

    expect(getCalledSubagentId(callMessage)).toBe("agent-child");
    expect(getCalledSubagentId(ordinaryMessage)).toBeUndefined();
    expect(getCalledSubagentId(malformedMessage)).toBeUndefined();
    expect(
      getCalledSubagentIds([callMessage, ordinaryMessage, malformedMessage])
    ).toEqual(["agent-child"]);
  });
});

function event(
  sequence: number,
  type: string,
  payload: unknown
): AgentEventEnvelope {
  return { agentId: "agent-1", payload, sequence, timestamp: "now", type };
}
