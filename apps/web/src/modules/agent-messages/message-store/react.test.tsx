// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentTasksContext } from "../tasks-context/context";
import {
  useAgentMessage,
  useAgentMessageIds
} from "../tasks-context/context";
import { createInitialAgentTaskState } from "../reducer";
import { createAgentMessageStore } from ".";
import type {
  AgentTasksContextValue
} from "../tasks-context/context";
import type { AgentEventEnvelope } from "../agent-message-types";
import type { WebPlugin } from "@hold-rein/plugin-web";

describe("agent message store React hooks", () => {
  it("rerenders only subscribers for the updated streaming message", () => {
    const store = createAgentMessageStore();
    const idsRender = vi.fn();
    const firstRender = vi.fn();
    const secondRender = vi.fn();

    store.replaceAgentMessages("agent-1", [
      assistantMessage("assistant-1", "One"),
      assistantMessage("assistant-2", "Tw")
    ]);

    function Probe() {
      const ids = useAgentMessageIds("agent-1");

      idsRender(ids);

      return (
        <>
          <MessageProbe id="assistant-1" onRender={firstRender} />
          <MessageProbe id="assistant-2" onRender={secondRender} />
        </>
      );
    }

    render(
      <AgentTasksContext.Provider value={contextValue(store)}>
        <Probe />
      </AgentTasksContext.Provider>
    );

    act(() => {
      store.reduceAgentEvent("agent-1", messageDelta("assistant-2", "o"));
    });

    expect(idsRender).toHaveBeenCalledTimes(1);
    expect(firstRender).toHaveBeenCalledTimes(1);
    expect(secondRender).toHaveBeenCalledTimes(2);
    expect(secondRender).toHaveBeenLastCalledWith("Two");
  });
});

function MessageProbe({
  id,
  onRender
}: {
  id: string;
  onRender: (text: string) => void;
}) {
  const message = useAgentMessage("agent-1", id);
  const text =
    message?.role === "assistant" && message.content[0]?.type === "text"
      ? message.content[0].text
      : "";

  onRender(text);

  return <span>{text}</span>;
}

function contextValue(
  messageStore: ReturnType<typeof createAgentMessageStore>
): AgentTasksContextValue {
  return {
    cancelTask: async () => undefined,
    continueTask: async () => undefined,
    decideApproval: async () => undefined,
    getPendingApproval: () => undefined,
    getSubagentMessages: () => [],
    getSubagentStatus: () => undefined,
    getTaskState: (taskId) => ({
      ...createInitialAgentTaskState(taskId),
      messages: messageStore.getAgentMessages(taskId)
    }),
    hasPendingApproval: () => false,
    hasUnreadCompletion: () => false,
    messageStore,
    startTask: async () => undefined
  };
}

function assistantMessage(id: string, text: string): WebPlugin.AgentMessage {
  return {
    api: "openai-responses",
    content: [{ text, type: "text" }],
    id,
    model: "gpt-4.1",
    provider: "openai",
    role: "assistant",
    stopReason: "stop",
    timestamp: 1
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
