import { describe, expect, it } from "vitest";

import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from ".";

describe("agent task message reducer", () => {
  it("does not keep messages in task state", () => {
    expect(createInitialAgentTaskState("task-1")).not.toHaveProperty("messages");
  });

  it("ignores message events because messages live in the message store", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      event: event(1, "message_start", {
        message: {
          content: [{ text: "Answer", type: "text" }],
          id: "message-1",
          role: "assistant",
          timestamp: 1
        }
      }),
      type: "event_received"
    });

    expect(state).not.toHaveProperty("messages");
    expect(state.lastSequence).toBe(1);
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
    expect(state).not.toHaveProperty("messages");
  });

  it("ignores approval requests that were already decided on the server", () => {
    const state = reduceAgentTaskState(createInitialAgentTaskState("task-1"), {
      event: event(1, "approval_requested", {
        agentId: "agent-1",
        approvalId: "approval-1",
        approved: true,
        status: "decided",
        tool: {
          input: {},
          name: "workspace_patch",
          toolCallId: "tool-call-1"
        }
      }),
      type: "event_received"
    });

    expect(state.pendingApprovals).toEqual([]);
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
    const running = {
      ...createInitialAgentTaskState("task-1"),
      status: "running" as const
    };
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
