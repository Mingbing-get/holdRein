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
});
