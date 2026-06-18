import { describe, expect, it } from "vitest";

import {
  discoverSubagents,
  initializeSubagentsFromHistory,
  reduceSubagentEvent
} from "./subagent-message-store";
import type { TaskSubagentHistory } from "./agent-message-types";

describe("subagent message store", () => {
  it("initializes restored subagent messages and statuses from task history", () => {
    const history: TaskSubagentHistory[] = [
      {
        agentId: "agent-child",
        messages: [assistantMessage("message-child", "Restored child")],
        parentAgentId: "agent-parent",
        status: "completed"
      }
    ];

    expect(initializeSubagentsFromHistory({}, history)).toEqual({
      "agent-child": {
        messages: [assistantMessage("message-child", "Restored child")],
        parentAgentId: "agent-parent",
        status: "completed"
      }
    });
  });

  it("preserves restored completed state when rediscovering the same child", () => {
    const current = initializeSubagentsFromHistory({}, [
      {
        agentId: "agent-child",
        messages: [assistantMessage("message-child", "Restored child")],
        parentAgentId: "agent-parent",
        status: "completed"
      }
    ]);

    expect(discoverSubagents(current, [callSubagentMessage("agent-child")]))
      .toBe(current);
  });

  it("discovers live children as running records", () => {
    expect(discoverSubagents({}, [callSubagentMessage("agent-child")]))
      .toEqual({
        "agent-child": {
          messages: [],
          parentAgentId: "",
          status: "running"
        }
      });
  });

  it("marks child records completed on terminal events", () => {
    const current = discoverSubagents({}, [callSubagentMessage("agent-child")]);

    expect(
      reduceSubagentEvent(current, "agent-child", {
        agentId: "agent-child",
        sequence: 1,
        timestamp: "now",
        type: "agent_end"
      })
    ).toEqual({
      "agent-child": {
        messages: [],
        parentAgentId: "",
        status: "completed"
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
