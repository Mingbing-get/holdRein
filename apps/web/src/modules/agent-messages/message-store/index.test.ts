import { describe, expect, it, vi } from "vitest";

import { createAgentMessageStore } from ".";
import type { AgentEventEnvelope } from "../agent-message-types";

describe("AgentMessageStore", () => {
  it("notifies only the changed message when a streaming chunk updates existing content", () => {
    const store = createAgentMessageStore();
    const idsListener = vi.fn();
    const messageListener = vi.fn();

    store.replaceTaskMessages("task-1", [
      {
        api: "openai-responses",
        content: [{ text: "Hel", type: "text" }],
        id: "assistant-1",
        model: "gpt-4.1",
        provider: "openai",
        role: "assistant",
        stopReason: "stop",
        timestamp: 1
      }
    ]);

    store.subscribeTaskMessageIds("task-1", idsListener);
    store.subscribeTaskMessage("task-1", "assistant-1", messageListener);

    store.reduceTaskEvent("task-1", messageDelta("assistant-1", "lo"));

    expect(idsListener).not.toHaveBeenCalled();
    expect(messageListener).toHaveBeenCalledTimes(1);
    expect(store.getTaskMessageIds("task-1")).toEqual(["assistant-1"]);
    expect(store.getTaskMessage("task-1", "assistant-1")).toMatchObject({
      content: [{ text: "Hello", type: "text" }]
    });
  });
});

function messageDelta(messageId: string, delta: string): AgentEventEnvelope {
  return {
    agentId: "agent-1",
    payload: {
      delta: { contentIndex: 0, delta, type: "text_delta" },
      messageId
    },
    sequence: 2,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "message_delta"
  };
}
