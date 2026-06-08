// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { AgentMessage } from "./agent-message-types";
import { AgentMessageList } from "./message-list";

describe("AgentMessageList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders each normalized message kind", () => {
    const messages: AgentMessage[] = [
      { content: "User prompt", id: "1", kind: "user" },
      { content: "Assistant answer", id: "2", kind: "assistant" },
      { content: "Thinking trace", id: "3", kind: "thinking" },
      { content: "shell_exec", id: "4", kind: "tool" },
      { content: "pnpm test", id: "5", kind: "approval" },
      { content: "Failed", id: "6", kind: "error" },
      {
        content: "Unrecognized",
        eventType: "new_event",
        id: "7",
        kind: "fallback"
      }
    ];

    render(<AgentMessageList messages={messages} />);

    for (const message of messages) {
      expect(screen.getByText(message.content)).toBeInTheDocument();
    }
    expect(screen.getByText("需要批准")).toBeInTheDocument();
    expect(screen.getByText("new_event")).toBeInTheDocument();
  });
});
