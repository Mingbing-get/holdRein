// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AgentMessageList } from "./message-list";

describe("AgentMessageList", () => {
  afterEach(cleanup);

  it("renders structured user and assistant content", () => {
    render(
      <AgentMessageList
        messages={[
          { content: [{ text: "Prompt", type: "text" }], id: "1", role: "user", timestamp: 1 },
          {
            api: "openai-responses",
            content: [
              { thinking: "Reason", type: "thinking" },
              { text: "Answer", type: "text" }
            ],
            id: "2",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 2
          }
        ]}
      />
    );

    expect(screen.getByText("Prompt")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });
});
