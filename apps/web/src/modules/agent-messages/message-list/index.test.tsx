// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentMessageList } from ".";
import type { WebPlugin } from "@hold-rein/plugin-web";

const agentTasksMock = vi.hoisted(() => ({
  activeTaskId: "task-1",
  childMessages: {} as Record<string, WebPlugin.AgentMessage[]>,
  taskMessages: [] as WebPlugin.AgentMessage[],
  turnFooterRenders: [] as WebPlugin.TurnFooterRender[]
}));

vi.mock("../../../app/app-workspace-context", () => ({
  useAppWorkspace: () => ({
    state: { activeTaskId: agentTasksMock.activeTaskId }
  })
}));

vi.mock("../tasks-context", () => ({
  useAgentTasks: () => ({
    getSubagentMessages: (agentId: string) =>
      agentTasksMock.childMessages[agentId] ?? [],
    getSubagentStatus: () => undefined,
    getTaskState: (taskId: string) =>
      taskId === agentTasksMock.activeTaskId
        ? { messages: agentTasksMock.taskMessages }
        : undefined
  })
}));

vi.mock("../../../app/app-plugin", () => ({
  useAppPlugins: () => ({
    toolRenders: [],
    turnFooterRenders: agentTasksMock.turnFooterRenders
  })
}));

describe("AgentMessageList", () => {
  afterEach(() => {
    cleanup();
    agentTasksMock.activeTaskId = "task-1";
    agentTasksMock.childMessages = {};
    agentTasksMock.taskMessages = [];
    agentTasksMock.turnFooterRenders = [];
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

    fireEvent.click(screen.getByText("thinking"));

    expect(screen.getByText("Prompt")).toBeInTheDocument();
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Answer")).toBeInTheDocument();
  });

  it("renders plugin footers after completed assistant turns", () => {
    agentTasksMock.turnFooterRenders = [
      {
        id: "turn-summary",
        Render: () => <div>turn summary</div>
      }
    ];

    render(
      <AgentMessageList
        messages={[
          { content: "First prompt", id: "user-1", role: "user", timestamp: 1 },
          {
            api: "openai-responses",
            content: [{ text: "First answer", type: "text" }],
            id: "assistant-1",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 2
          },
          { content: "Second prompt", id: "user-2", role: "user", timestamp: 3 },
          {
            api: "openai-responses",
            content: [{ text: "Second answer", type: "text" }],
            id: "assistant-2",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 4
          }
        ]}
        status="completed"
      />
    );

    expect(screen.getAllByText("turn summary")).toHaveLength(2);
  });

  it("passes the completed turn messages to plugin footers", () => {
    agentTasksMock.turnFooterRenders = [
      {
        id: "turn-summary",
        Render: ({ messages }) => (
          <div data-testid="turn-summary">{messages.map((message) => message.id).join(",")}</div>
        )
      }
    ];

    render(
      <AgentMessageList
        messages={[
          { content: "Run command", id: "user-1", role: "user", timestamp: 1 },
          {
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
            timestamp: 2
          },
          {
            content: [{ text: "Tests passed", type: "text" }],
            id: "tool-result-1",
            isError: false,
            role: "toolResult",
            timestamp: 3,
            toolCallId: "tool-call-1",
            toolName: "bash"
          }
        ]}
        status="completed"
      />
    );

    expect(screen.getByTestId("turn-summary")).toHaveTextContent(
      "user-1,assistant-1,tool-result-1"
    );
  });

  it("renders every plugin footer in a vertical flex container", () => {
    agentTasksMock.turnFooterRenders = [
      {
        id: "first-footer",
        Render: () => <div>first footer</div>
      },
      {
        id: "second-footer",
        Render: () => <div>second footer</div>
      }
    ];

    render(
      <AgentMessageList
        messages={[
          { content: "Prompt", id: "user-1", role: "user", timestamp: 1 },
          {
            api: "openai-responses",
            content: [{ text: "Answer", type: "text" }],
            id: "assistant-1",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 2
          }
        ]}
        status="completed"
      />
    );

    const footer = screen.getByTestId("agent-turn-footer");

    expect(footer).toHaveClass("ant-flex-vertical");
    expect(screen.getByText("first footer")).toBeInTheDocument();
    expect(screen.getByText("second footer")).toBeInTheDocument();
  });

  it("does not render a footer after the running final assistant turn", () => {
    render(
      <AgentMessageList
        messages={[
          { content: "First prompt", id: "user-1", role: "user", timestamp: 1 },
          {
            api: "openai-responses",
            content: [{ text: "First answer", type: "text" }],
            id: "assistant-1",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 2
          },
          { content: "Second prompt", id: "user-2", role: "user", timestamp: 3 },
          {
            api: "openai-responses",
            content: [{ text: "Streaming answer", type: "text" }],
            id: "assistant-2",
            model: "gpt-4.1",
            provider: "openai",
            role: "assistant",
            stopReason: "stop",
            timestamp: 4
          }
        ]}
        status="running"
      />
    );

    expect(screen.queryByTestId("agent-turn-footer")).not.toBeInTheDocument();
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

  it("does not render the internal empty continue user message", () => {
    const { container } = render(
      <AgentMessageList
        messages={[
          {
            content: "",
            id: "continue-message",
            role: "user",
            timestamp: 1
          },
          {
            content: "Visible prompt",
            id: "visible-message",
            role: "user",
            timestamp: 2
          }
        ]}
      />
    );

    expect(screen.getByText("Visible prompt")).toBeInTheDocument();
    expect(container.querySelectorAll(".ant-bubble")).toHaveLength(1);
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
    const messages: WebPlugin.AgentMessage[] = [
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

    render(<AgentMessageList messages={messages} />);

    fireEvent.click(screen.getByText("run tool: bash"));

    expect(screen.getByText("参数")).toBeInTheDocument();
    expect(screen.getByText(/"command": "pnpm test"/)).toBeInTheDocument();
    expect(screen.getByText("执行结果")).toBeInTheDocument();
    expect(screen.getByText("Tests passed")).toBeInTheDocument();
  });

  it("renders child messages inside a callsubagent message", () => {
    agentTasksMock.childMessages["agent-child"] = [
      {
        api: "openai-responses",
        content: [{ text: "Child answer", type: "text" }],
        id: "child-answer",
        model: "gpt-4.1",
        provider: "openai",
        role: "assistant",
        stopReason: "stop",
        timestamp: 2
      }
    ];

    render(
      <AgentMessageList
        messages={[
          {
            content: "Subagent is running",
            customType: "callsubagent",
            details: { agentId: "agent-child" },
            display: true,
            id: "call-child",
            role: "custom",
            timestamp: 1
          }
        ]}
      />
    );

    expect(screen.getByText("call subagent")).toBeInTheDocument();
    fireEvent.click(screen.getByText("call subagent"));
    expect(screen.getByText("Child answer")).toBeInTheDocument();
    expect(screen.queryByText("Subagent is running")).not.toBeInTheDocument();
  });

  it("keeps generic rendering for malformed callsubagent messages", () => {
    render(
      <AgentMessageList
        messages={[
          {
            content: "Missing child identifier",
            customType: "callsubagent",
            details: {},
            display: true,
            id: "malformed-call",
            role: "custom",
            timestamp: 1
          }
        ]}
      />
    );

    fireEvent.click(screen.getByText("callsubagent"));
    expect(screen.getByText("Missing child identifier")).toBeInTheDocument();
  });

  it("styles Markdown with application theme variables", () => {
    const markdownCss = readFileSync(
      "apps/web/src/modules/agent-messages/message-list/index.css",
      "utf8"
    );
    const themeCss = readFileSync("apps/web/src/app/theme.css", "utf8");

    expect(markdownCss).toContain("var(--app-color-text)");
    expect(markdownCss).not.toMatch(/#[\da-f]{3,8}|rgba?\(/i);
    expect(themeCss.match(/--app-color-markdown-code-bg:/g)).toHaveLength(2);
  });
});
