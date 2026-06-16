// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentMessageList } from "./message-list";
import type { WebPlugin } from "@hold-rein/plugin-web";

const agentTasksMock = vi.hoisted(() => ({
  activeTaskId: "task-1",
  taskMessages: [] as WebPlugin.AgentMessage[]
}));

vi.mock("../../app/app-workspace-context", () => ({
  useAppWorkspace: () => ({
    state: { activeTaskId: agentTasksMock.activeTaskId }
  })
}));

vi.mock("./agent-tasks-context", () => ({
  useAgentTasks: () => ({
    getTaskState: (taskId: string) =>
      taskId === agentTasksMock.activeTaskId
        ? { messages: agentTasksMock.taskMessages }
        : undefined
  })
}));

vi.mock("../../app/app-plugin", () => ({
  useAppPlugins: () => ({
    toolRenders: []
  })
}));

describe("AgentMessageList", () => {
  afterEach(() => {
    cleanup();
    agentTasksMock.activeTaskId = "task-1";
    agentTasksMock.taskMessages = [];
  });

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

  it("renders tool arguments and result through its tool call", () => {
    const assistantMessage: WebPlugin.AgentMessage = {
      api: "openai-responses",
      content: [
        {
          arguments: { command: "pnpm test" },
          id: "tool-call-1",
          name: "bash",
          type: "toolCall"
        }
      ],
      id: "assistant-1",
      model: "gpt-4.1",
      provider: "openai",
      role: "assistant",
      stopReason: "toolUse",
      timestamp: 1
    };
    agentTasksMock.taskMessages = [
      assistantMessage,
      {
        content: [{ text: "Tests passed", type: "text" }],
        id: "tool-result-1",
        isError: false,
        role: "toolResult",
        timestamp: 2,
        toolCallId: "tool-call-1",
        toolName: "bash"
      }
    ];

    render(<AgentMessageList messages={[assistantMessage]} />);

    fireEvent.click(screen.getByText("run tool: bash"));

    expect(screen.getByText("参数")).toBeInTheDocument();
    expect(screen.getByText(/"command": "pnpm test"/)).toBeInTheDocument();
    expect(screen.getByText("执行结果")).toBeInTheDocument();
    expect(screen.getByText("Tests passed")).toBeInTheDocument();
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
