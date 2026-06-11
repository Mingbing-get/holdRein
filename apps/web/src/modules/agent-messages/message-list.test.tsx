// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
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

  it("renders Markdown only for assistant text blocks", () => {
    render(
      <AgentMessageList
        messages={[
          { content: "## User heading", id: "1", role: "user", timestamp: 1 },
          {
            api: "openai-responses",
            content: [{ text: "## Assistant heading", type: "text" }],
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

    expect(screen.getByText("## User heading")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Assistant heading" })
    ).toBeInTheDocument();
  });

  it("styles Markdown with application theme variables", () => {
    const markdownCss = readFileSync(
      "apps/web/src/modules/agent-messages/markdown-content.css",
      "utf8"
    );
    const themeCss = readFileSync("apps/web/src/app/theme.css", "utf8");

    expect(markdownCss).toContain("var(--app-color-markdown-code-bg)");
    expect(markdownCss).toContain("var(--app-color-text)");
    expect(markdownCss).not.toMatch(/#[\da-f]{3,8}|rgba?\(/i);
    expect(themeCss.match(/--app-color-markdown-code-bg:/g)).toHaveLength(2);
  });
});
