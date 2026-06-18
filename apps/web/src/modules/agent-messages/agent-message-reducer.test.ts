import { describe, expect, it } from "vitest";

import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "./agent-message-reducer";

const assistant = {
  api: "openai-responses",
  content: [],
  id: "message-1",
  model: "gpt-4.1",
  provider: "openai",
  role: "assistant" as const,
  stopReason: "stop" as const,
  timestamp: 1
};

describe("agent task message reducer", () => {
  it("loads stored Harness-shaped messages", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      messages: [{ content: "Prompt", id: "message-0", role: "user", timestamp: 0 }],
      type: "history_loaded"
    });

    expect(state.messages[0]?.role).toBe("user");
  });

  it("merges assistant text and thinking deltas", () => {
    const events = [
      event(1, "message_start", { message: assistant }),
      event(2, "message_delta", {
        delta: { contentIndex: 0, type: "text_start" },
        messageId: "message-1"
      }),
      event(3, "message_delta", {
        delta: { contentIndex: 0, delta: "Answer", type: "text_delta" },
        messageId: "message-1"
      }),
      event(4, "message_delta", {
        delta: { contentIndex: 1, type: "thinking_start" },
        messageId: "message-1"
      }),
      event(5, "message_delta", {
        delta: { contentIndex: 1, delta: "Reason", type: "thinking_delta" },
        messageId: "message-1"
      })
    ];
    const state = events.reduce(
      (current, item) =>
        reduceAgentTaskState(current, { event: item, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.messages[0]).toEqual(
      expect.objectContaining({
        content: [
          { text: "Answer", type: "text" },
          { thinking: "Reason", type: "thinking" }
        ]
      })
    );
  });

  it("replaces streamed content with the final message", () => {
    const finalMessage = { ...assistant, content: [{ text: "Final", type: "text" as const }] };
    const state = [event(1, "message_start", { message: assistant }), event(2, "message_end", { message: finalMessage })]
      .reduce(
        (current, item) =>
          reduceAgentTaskState(current, { event: item, type: "event_received" }),
        createInitialAgentTaskState("task-1")
      );

    expect(state.messages).toEqual([finalMessage]);
  });

  it("replaces the optimistic prompt with the persisted user message", () => {
    const optimistic = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      prompt: "Continue",
      type: "prompt_submitted"
    });
    const persisted = {
      content: [{ text: "Continue", type: "text" as const }],
      id: "message-user",
      role: "user" as const,
      timestamp: 2
    };
    const state = reduceAgentTaskState(optimistic, {
      event: event(1, "message_start", { message: persisted }),
      type: "event_received"
    });

    expect(state.messages).toEqual([persisted]);
  });

  it("keeps callsubagent messages without adding child runs", () => {
    const message = {
      content: "Subagent is running",
      customType: "callsubagent",
      details: { agentId: "agent-child", session: { id: "session-child" } },
      display: true,
      id: "message-subagent",
      role: "custom" as const,
      timestamp: 2
    };
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      event: event(1, "message_start", { message }),
      type: "event_received"
    });

    expect(state.messages).toEqual([message]);
    expect(state).not.toHaveProperty("runs");
  });

  it("loads callsubagent history without adding child runs", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      messages: [{
        content: "Subagent is running",
        customType: "callsubagent",
        details: { agentId: "agent-child", session: { id: "session-child" } },
        display: true,
        id: "message-subagent",
        role: "custom",
        timestamp: 2
      }],
      type: "history_loaded"
    });

    expect(state.messages).toHaveLength(1);
    expect(state).not.toHaveProperty("runs");
  });

  it("queues approval requests without adding them to messages", () => {
    const approval = {
      agentId: "agent-1",
      approvalId: "approval-1",
      title: "允许插件修改工作区？",
      tool: {
        description: "Apply the requested workspace change",
        input: { file: "src/index.ts" },
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    };
    const state = [
      event(1, "approval_requested", approval),
      event(2, "approval_requested", approval)
    ].reduce(
      (current, item) =>
        reduceAgentTaskState(current, { event: item, type: "event_received" }),
      createInitialAgentTaskState("task-1")
    );

    expect(state.pendingApprovals).toEqual([approval]);
    expect(state.messages).toEqual([]);
  });

  it("removes a decided approval", () => {
    const queued = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      event: event(1, "approval_requested", {
        agentId: "agent-1",
        approvalId: "approval-1",
        tool: {
          input: {},
          name: "workspace_patch",
          toolCallId: "tool-call-1"
        }
      }),
      type: "event_received"
    });

    const state = reduceAgentTaskState(queued, {
      approvalId: "approval-1",
      type: "approval_decided"
    });

    expect(state.pendingApprovals).toEqual([]);
  });

  it("keeps the task running when an agent run ends before the task ends", () => {
    const running = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      prompt: "Inspect",
      type: "prompt_submitted"
    });
    const state = reduceAgentTaskState(running, {
      event: event(1, "agent_end", undefined),
      type: "event_received"
    });

    expect(state.status).toBe("running");
  });

  it("marks the task completed when the task ends", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      event: event(1, "task_end", undefined),
      type: "event_received"
    });

    expect(state.status).toBe("completed");
  });
});

function event(sequence: number, type: string, payload: unknown) {
  return { agentId: "agent-1", payload, sequence, timestamp: "now", type };
}
