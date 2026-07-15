import { describe, expect, it, vi } from "vitest";

import { createAgentMessageStore } from ".";
import type { AgentEventEnvelope } from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

describe("AgentMessageStore", () => {
  it("notifies only message id subscribers when appending an optimistic prompt", () => {
    const store = createAgentMessageStore();
    const idsListener = vi.fn();
    const messageListener = vi.fn();
    const toolResultListener = vi.fn();

    store.subscribeTaskMessageIds("task-1", idsListener);
    store.subscribeTaskMessage("task-1", "prompt-0", messageListener);
    store.subscribeToolResult("task-1", "tool-call-1", toolResultListener);

    store.appendOptimisticPrompt("task-1", "Hello");

    expect(idsListener).toHaveBeenCalledTimes(1);
    expect(messageListener).not.toHaveBeenCalled();
    expect(toolResultListener).not.toHaveBeenCalled();
    expect(store.getTaskMessageIds("task-1")).toEqual(["prompt-0"]);
    expect(store.getTaskMessage("task-1", "prompt-0")).toMatchObject({
      content: [{ text: "Hello", type: "text" }]
    });
  });

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

  it("notifies only message id subscribers when an event appends a new message", () => {
    const store = createAgentMessageStore();
    const idsListener = vi.fn();
    const messageListener = vi.fn();

    store.subscribeTaskMessageIds("task-1", idsListener);
    store.subscribeTaskMessage("task-1", "assistant-1", messageListener);

    store.reduceTaskEvent("task-1", messageStart(assistantMessage("assistant-1", "")));

    expect(idsListener).toHaveBeenCalledTimes(1);
    expect(messageListener).not.toHaveBeenCalled();
    expect(store.getTaskMessageIds("task-1")).toEqual(["assistant-1"]);
  });

  it("notifies only tool result subscribers when an event stores a tool result", () => {
    const store = createAgentMessageStore();
    const idsListener = vi.fn();
    const messageListener = vi.fn();
    const toolResultListener = vi.fn();

    store.subscribeTaskMessageIds("task-1", idsListener);
    store.subscribeTaskMessage("task-1", "tool-result-1", messageListener);
    store.subscribeToolResult("task-1", "tool-call-1", toolResultListener);

    store.reduceTaskEvent(
      "task-1",
      messageStart(toolResultMessage("tool-result-1", "tool-call-1", "result"))
    );

    expect(idsListener).not.toHaveBeenCalled();
    expect(messageListener).not.toHaveBeenCalled();
    expect(toolResultListener).toHaveBeenCalledTimes(1);
    expect(store.getTaskMessageIds("task-1")).toEqual(["tool-result-1"]);
    expect(store.getToolResult("task-1", "tool-call-1")).toMatchObject({
      content: [{ text: "result", type: "text" }]
    });
  });
});

function assistantMessage(id: string, text: string): WebPlugin.AssistantMessage {
  return {
    api: "openai-responses",
    content: text ? [{ text, type: "text" }] : [],
    id,
    model: "gpt-4.1",
    provider: "openai",
    role: "assistant",
    stopReason: "stop",
    timestamp: 1
  };
}

function toolResultMessage(
  id: string,
  toolCallId: string,
  text: string
): WebPlugin.ToolResultMessage {
  return {
    content: [{ text, type: "text" }],
    id,
    isError: false,
    role: "toolResult",
    timestamp: 1,
    toolCallId,
    toolName: "bash"
  };
}

function messageStart(message: WebPlugin.AgentMessage): AgentEventEnvelope {
  return {
    agentId: "agent-1",
    payload: { message },
    sequence: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "message_start"
  };
}

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
