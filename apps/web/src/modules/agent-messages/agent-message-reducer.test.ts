import { describe, expect, it } from "vitest";

import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "./agent-message-reducer";

describe("agent task message reducer", () => {
  it("stores the submitted prompt as a user message", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      prompt: "Inspect this project",
      type: "prompt_submitted"
    });

    expect(state.messages).toEqual([
      expect.objectContaining({
        content: "Inspect this project",
        kind: "user"
      })
    ]);
  });

  it("normalizes assistant, thinking, tool, approval, error, and unknown events", () => {
    const events = [
      {
        agentId: "agent-1",
        payload: { delta: "Hello" },
        sequence: 1,
        timestamp: "now",
        type: "message_update"
      },
      {
        agentId: "agent-1",
        payload: { text: "Considering options" },
        sequence: 2,
        timestamp: "now",
        type: "thinking"
      },
      {
        agentId: "agent-1",
        payload: { toolName: "shell_exec" },
        sequence: 3,
        timestamp: "now",
        type: "tool_execution_start"
      },
      {
        agentId: "agent-1",
        payload: { approvalId: "approval-1", command: "pnpm test" },
        sequence: 4,
        timestamp: "now",
        type: "approval_requested"
      },
      {
        agentId: "agent-1",
        payload: { message: "Failed" },
        sequence: 5,
        timestamp: "now",
        type: "agent_error"
      },
      {
        agentId: "agent-1",
        payload: { value: true },
        sequence: 6,
        timestamp: "now",
        type: "new_event"
      }
    ];

    const state = events.reduce(
      (current, event) =>
        reduceAgentTaskState(current, { event, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.messages.map((message) => message.kind)).toEqual([
      "assistant",
      "thinking",
      "tool",
      "approval",
      "error",
      "fallback"
    ]);
    expect(state.lastSequence).toBe(6);
  });

  it("merges streamed message updates into the active message", () => {
    const events = [
      {
        agentId: "agent-1",
        payload: {
          assistantMessageEvent: { delta: "Hello", type: "text_delta" },
          message: { content: [{ text: "Hello", type: "text" }] }
        },
        sequence: 1,
        timestamp: "now",
        type: "message_update"
      },
      {
        agentId: "agent-1",
        payload: {
          assistantMessageEvent: { delta: " world", type: "text_delta" },
          message: { content: [{ text: "Hello world", type: "text" }] }
        },
        sequence: 2,
        timestamp: "now",
        type: "message_update"
      }
    ];

    const state = events.reduce(
      (current, event) =>
        reduceAgentTaskState(current, { event, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(
      expect.objectContaining({ content: "Hello world", kind: "assistant" })
    );
  });

  it("uses message boundaries without rendering them", () => {
    const events = [
      {
        agentId: "agent-1",
        payload: { message: { role: "assistant" } },
        sequence: 1,
        timestamp: "now",
        type: "message_start"
      },
      {
        agentId: "agent-1",
        payload: { delta: "First" },
        sequence: 2,
        timestamp: "now",
        type: "message_update"
      },
      {
        agentId: "agent-1",
        payload: { message: { role: "assistant" } },
        sequence: 3,
        timestamp: "now",
        type: "message_end"
      },
      {
        agentId: "agent-1",
        payload: { delta: "Second" },
        sequence: 4,
        timestamp: "now",
        type: "message_update"
      }
    ];

    const state = events.reduce(
      (current, event) =>
        reduceAgentTaskState(current, { event, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.messages.map((message) => message.content)).toEqual([
      "First",
      "Second"
    ]);
    expect(state.lastSequence).toBe(4);
  });

  it("splits text and thinking deltas at their content boundaries", () => {
    const update = (
      sequence: number,
      assistantMessageEvent: Record<string, unknown>
    ) => ({
      agentId: "agent-1",
      payload: { assistantMessageEvent, message: { role: "assistant" } },
      sequence,
      timestamp: "now",
      type: "message_update"
    });
    const events = [
      update(1, { contentIndex: 0, type: "text_start" }),
      update(2, { contentIndex: 0, delta: "Answer", type: "text_delta" }),
      update(3, { contentIndex: 0, type: "text_end" }),
      update(4, { contentIndex: 1, type: "thinking_start" }),
      update(5, { contentIndex: 1, delta: "Reason", type: "thinking_delta" }),
      update(6, { contentIndex: 1, delta: "ing", type: "thinking_delta" }),
      update(7, { contentIndex: 1, type: "thinking_end" })
    ];

    const state = events.reduce(
      (current, event) =>
        reduceAgentTaskState(current, { event, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(
      state.messages.map(({ content, kind }) => ({ content, kind }))
    ).toEqual([
      { content: "Answer", kind: "assistant" },
      { content: "Reasoning", kind: "thinking" }
    ]);
  });

  it("ignores internal events without interrupting the active message", () => {
    const events = [
      {
        agentId: "agent-1",
        payload: { delta: "Keep" },
        sequence: 1,
        timestamp: "now",
        type: "message_update"
      },
      {
        agentId: "agent-1",
        payload: { messages: [] },
        sequence: 2,
        timestamp: "now",
        type: "context"
      },
      {
        agentId: "agent-1",
        payload: { delta: " going" },
        sequence: 3,
        timestamp: "now",
        type: "message_update"
      }
    ];

    const state = events.reduce(
      (current, event) =>
        reduceAgentTaskState(current, { event, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.messages.map((message) => message.content)).toEqual([
      "Keep going"
    ]);
  });
});
