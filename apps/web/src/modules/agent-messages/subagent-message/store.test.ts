import { describe, expect, it } from "vitest";

import {
  discoverSubagents,
  initializeSubagentsFromHistory,
  reduceSubagentEvent,
  reduceSubagentResumeEvent
} from "./store";
import type { TaskSubagentHistory } from "../agent-message-types";

describe("subagent message store", () => {
  it("initializes restored subagent metadata and statuses from task history", () => {
    const history: TaskSubagentHistory[] = [
      {
        agentName: "researcher",
        agentId: "agent-child",
        messages: [assistantMessage("message-child", "Restored child")],
        parentAgentId: "agent-parent",
        status: "completed"
      }
    ];

    expect(initializeSubagentsFromHistory({}, history, "task-1")).toEqual({
      "agent-child": {
        agentName: "researcher",
        parentAgentId: "agent-parent",
        status: "completed",
        taskId: "task-1"
      }
    });
  });

  it("preserves restored completed state when rediscovering the same child", () => {
    const current = initializeSubagentsFromHistory(
      {},
      [
        {
          agentName: "researcher",
          agentId: "agent-child",
          messages: [assistantMessage("message-child", "Restored child")],
          parentAgentId: "agent-parent",
          status: "completed"
        }
      ],
      "task-1"
    );

    expect(
      discoverSubagents(current, [callSubagentMessage("agent-child")], "task-1")
    ).toBe(current);
  });

  it("discovers live children as running records", () => {
    expect(
      discoverSubagents({}, [callSubagentMessage("agent-child")], "task-1")
    ).toEqual({
        "agent-child": {
          agentName: "subagent",
          parentAgentId: "",
          status: "running",
          taskId: "task-1"
        }
      });
  });

  it("marks child records completed on terminal events", () => {
    const current = discoverSubagents(
      {},
      [callSubagentMessage("agent-child")],
      "task-1"
    );

    expect(
      reduceSubagentEvent(current, "agent-child", {
        agentId: "agent-child",
        sequence: 1,
        timestamp: "now",
        type: "agent_end"
      })
    ).toEqual({
      "agent-child": {
        agentName: "subagent",
        parentAgentId: "",
        status: "completed",
        taskId: "task-1"
      }
    });
  });

  it("marks child records running on matching start events", () => {
    const current = {
      "agent-child": {
        agentName: "subagent",
        parentAgentId: "",
        status: "completed" as const,
        taskId: "task-1"
      }
    };

    expect(
      reduceSubagentEvent(current, "agent-child", {
        agentId: "agent-child",
        sequence: 2,
        timestamp: "now",
        type: "agent_start"
      })
    ).toEqual({
      "agent-child": {
        agentName: "subagent",
        parentAgentId: "",
        status: "running",
        taskId: "task-1"
      }
    });
  });

  it("ignores events for other agents and non-lifecycle events", () => {
    const current = discoverSubagents(
      {},
      [callSubagentMessage("agent-child")],
      "task-1"
    );

    expect(
      reduceSubagentEvent(current, "agent-child", {
        agentId: "agent-other",
        sequence: 1,
        timestamp: "now",
        type: "agent_end"
      })
    ).toBe(current);
    expect(
      reduceSubagentEvent(current, "agent-child", {
        agentId: "agent-child",
        sequence: 2,
        timestamp: "now",
        type: "message_start"
      })
    ).toBe(current);
  });

  it("marks a resumed child running without storing payload messages", () => {
    const current = initializeSubagentsFromHistory(
      {},
      [
        {
          agentName: "researcher",
          agentId: "agent-child",
          messages: [assistantMessage("message-child", "Finished child")],
          parentAgentId: "agent-parent",
          status: "completed"
        }
      ],
      "task-1"
    );

    expect(
      reduceSubagentResumeEvent(
        current,
        {
          agentId: "agent-parent",
          payload: {
            agentId: "agent-child",
            agentName: "analyst",
            messages: [userMessage("message-resume", "Resume child")],
            parentAgentId: "agent-parent",
            taskId: "task-1"
          },
          sequence: 2,
          timestamp: "now",
          type: "subagent_resumed"
        },
        "task-1"
      )
    ).toEqual({
      "agent-child": {
        agentName: "analyst",
        parentAgentId: "agent-parent",
        status: "running",
        taskId: "task-1"
      }
    });
  });
});

function assistantMessage(id: string, text: string) {
  return {
    api: "openai-responses",
    content: [{ text, type: "text" as const }],
    id,
    model: "gpt-4.1",
    provider: "openai",
    role: "assistant" as const,
    stopReason: "stop" as const,
    timestamp: 1
  };
}

function callSubagentMessage(agentId: string) {
  return {
    content: "Subagent is running",
    customType: "callsubagent",
    details: { agentId },
    display: true,
    id: `message-${agentId}`,
    role: "custom" as const,
    timestamp: 1
  };
}

function userMessage(id: string, text: string) {
  return {
    content: [{ text, type: "text" as const }],
    id,
    role: "user" as const,
    timestamp: 2
  };
}
