// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useTurnFooterMessageGroups } from ".";
import type { WebPlugin } from "@hold-rein/plugin-web";

describe("useTurnFooterMessageGroups", () => {
  it("returns completed historical turns while excluding the running final turn", () => {
    const messages: WebPlugin.AgentMessage[] = [
      userMessage("user-1", "First prompt"),
      assistantMessage("assistant-1", "First answer"),
      userMessage("user-2", "Second prompt"),
      assistantMessage("assistant-2", "Streaming answer")
    ];

    const { result } = renderHook(() =>
      useTurnFooterMessageGroups(messages, "running")
    );

    expect(result.current).toEqual([
      {
        beforeAssistantId: "assistant-1",
        messages: [messages[0], messages[1]]
      }
    ]);
  });

  it("returns the final assistant turn when the status is not running", () => {
    const messages: WebPlugin.AgentMessage[] = [
      userMessage("user-1", "First prompt"),
      assistantMessage("assistant-1", "First answer")
    ];

    const { result } = renderHook(() =>
      useTurnFooterMessageGroups(messages, "completed")
    );

    expect(result.current).toEqual([
      {
        beforeAssistantId: "assistant-1",
        messages
      }
    ]);
  });

  it("keeps tool results and custom messages inside their assistant turn", () => {
    const messages: WebPlugin.AgentMessage[] = [
      userMessage("user-1", "Run tests"),
      assistantMessage("assistant-1", "I will run them"),
      {
        content: [{ text: "ok", type: "text" }],
        id: "tool-result-1",
        isError: false,
        role: "toolResult",
        timestamp: 3,
        toolCallId: "tool-call-1",
        toolName: "bash"
      },
      {
        content: "Done",
        customType: "turn-note",
        display: true,
        id: "custom-1",
        role: "custom",
        timestamp: 4
      }
    ];

    const { result } = renderHook(() =>
      useTurnFooterMessageGroups(messages, "completed")
    );

    expect(result.current).toEqual([
      {
        beforeAssistantId: "assistant-1",
        messages
      }
    ]);
  });
});

function userMessage(id: string, text: string): WebPlugin.AgentMessage {
  return {
    content: [{ text, type: "text" }],
    id,
    role: "user",
    timestamp: 1
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
    timestamp: 2
  };
}
