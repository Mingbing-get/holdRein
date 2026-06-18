// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import type { AgentMessageFetcher } from "./agent-message-api";
import { AgentTasksProvider, useAgentTasks } from "./agent-tasks-context";
import {
  jsonResponse,
  startResult,
  streamResponse
} from "./agent-tasks-context-test-utils";
import type { WebPlugin } from "@hold-rein/plugin-web";

describe("AgentTasksProvider subagent messages", () => {
  afterEach(cleanup);

  it("keeps child messages out of the parent task collection", async () => {
    const fetcher = createSubagentFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <SubagentProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("parent-messages")).toHaveTextContent(
        "user,callsubagent"
      );
      expect(screen.getByTestId("child-messages")).toHaveTextContent(
        "Child answer"
      );
    });

    expect(screen.getByTestId("parent-messages")).not.toHaveTextContent(
      "assistant"
    );
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith("/api/v1/agents/agent-child/events")
      )
    ).toHaveLength(1);
  });

  it("discovers descendants from child messages", async () => {
    const fetcher = createSubagentFetcher(true);

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <SubagentProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("grandchild-messages")).toHaveTextContent(
        "Grandchild answer"
      );
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-grandchild/events",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("restores completed child history without subscribing to it", async () => {
    const fetcher = createHistoryFetcher("completed");

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <HistoryProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-child-messages")).toHaveTextContent(
        "Restored child answer"
      );
    });
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith("/api/v1/agents/agent-history-child/events")
      )
    ).toBe(false);
  });

  it("subscribes to running children restored from task history", async () => {
    const fetcher = createHistoryFetcher("running");

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <HistoryProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("history-child-messages")).toHaveTextContent(
        "Restored child answer,Live child answer"
      );
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-history-child/events",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

function SubagentProbe() {
  const { getSubagentMessages, getTaskState, startTask } = useAgentTasks();

  useEffect(() => {
    void startTask({
      modelId: "gpt-4.1",
      prompt: "Inspect the project",
      provider: "openai",
      workspacePath: "/workspace"
    });
  }, [startTask]);

  const parentMessages = getTaskState("task-1")?.messages ?? [];
  const childMessages = getSubagentMessages("agent-child");
  const grandchildMessages = getSubagentMessages("agent-grandchild");

  return (
    <>
      <span data-testid="parent-messages">
        {parentMessages
          .map((message) =>
            message.role === "custom" ? message.customType : message.role
          )
          .join(",")}
      </span>
      <span data-testid="child-messages">
        {childMessages
          .flatMap((message) =>
            "content" in message && Array.isArray(message.content)
              ? message.content.flatMap((block) =>
                  block.type === "text" && "text" in block ? [block.text] : []
                )
              : []
          )
          .join(",")}
      </span>
      <span data-testid="grandchild-messages">
        {getAssistantText(grandchildMessages)}
      </span>
    </>
  );
}

function HistoryProbe() {
  const { setActiveTaskId, setActiveWorkspaceId, setWorkspaces } =
    useAppWorkspace();
  const { getSubagentMessages } = useAgentTasks();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-history",
        name: "workspace",
        path: "/workspace",
        tasks: [
          {
            id: "task-history",
            initialUserMessage: "Inspect",
            lastContinuedAt: "2026-06-18T00:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "Inspect"
          }
        ]
      }
    ]);
    setActiveWorkspaceId("workspace-history");
    setActiveTaskId("task-history");
  }, [setActiveTaskId, setActiveWorkspaceId, setWorkspaces]);

  return (
    <span data-testid="history-child-messages">
      {getAssistantText(getSubagentMessages("agent-history-child"))}
    </span>
  );
}

function createSubagentFetcher(
  nested = false
): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
    }
    if (url.endsWith("/title")) {
      return jsonResponse({ id: "task-1", title: "Project inspection" });
    }
    return streamResponse((controller) => {
      if (url.includes("agent-1/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              agentId: "agent-1",
              payload: {
                message: {
                  content: "Subagent is running",
                  customType: "callsubagent",
                  details: { agentId: "agent-child" },
                  display: true,
                  id: "message-subagent",
                  role: "custom",
                  timestamp: 1
                }
              },
              sequence: 1,
              timestamp: "now",
              type: "message_start"
            })}\n`
          )
        );
      }
      if (url.includes("agent-child/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              agentId: "agent-child",
              payload: {
                message: {
                  api: "openai-responses",
                  content: [{ text: "Child answer", type: "text" }],
                  id: "message-child-answer",
                  model: "gpt-4.1",
                  provider: "openai",
                  role: "assistant",
                  stopReason: "stop",
                  timestamp: 2
                }
              },
              sequence: 1,
              timestamp: "now",
              type: "message_start"
            })}\n`
          )
        );
        if (nested) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                agentId: "agent-child",
                payload: {
                  message: {
                    content: "Grandchild is running",
                    customType: "callsubagent",
                    details: { agentId: "agent-grandchild" },
                    display: true,
                    id: "message-grandchild-call",
                    role: "custom",
                    timestamp: 3
                  }
                },
                sequence: 2,
                timestamp: "now",
                type: "message_start"
              })}\n`
            )
          );
        }
      }
      if (url.includes("agent-grandchild/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify(assistantEvent("agent-grandchild", "Grandchild answer"))}\n`
          )
        );
      }
    });
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function createHistoryFetcher(
  status: "completed" | "running"
): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/tasks/task-history/messages")) {
      return jsonResponse({
        messages: [
          {
            content: "Subagent is running",
            customType: "callsubagent",
            details: { agentId: "agent-history-child" },
            display: true,
            id: "message-history-child-call",
            role: "custom",
            timestamp: 1
          }
        ],
        subagents: [
          {
            agentId: "agent-history-child",
            messages: [
              assistantEvent("agent-history-child", "Restored child answer")
                .payload.message
            ],
            parentAgentId: "agent-parent",
            status
          }
        ]
      });
    }
    return streamResponse((controller) => {
      if (url.includes("agent-history-child/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              ...assistantEvent("agent-history-child", "Live child answer"),
              payload: {
                message: {
                  ...assistantEvent("agent-history-child", "Live child answer")
                    .payload.message,
                  id: "message-agent-history-child-live"
                }
              }
            })}\n`
          )
        );
      }
    });
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function assistantEvent(agentId: string, text: string) {
  return {
    agentId,
    payload: {
      message: {
        api: "openai-responses",
        content: [{ text, type: "text" }],
        id: `message-${agentId}-answer`,
        model: "gpt-4.1",
        provider: "openai",
        role: "assistant",
        stopReason: "stop",
        timestamp: 2
      }
    },
    sequence: 1,
    timestamp: "now",
    type: "message_start"
  };
}

function getAssistantText(messages: WebPlugin.AgentMessage[]): string {
  return messages
    .flatMap((message) =>
      "content" in message && Array.isArray(message.content)
        ? message.content.flatMap((block) =>
            block.type === "text" && "text" in block ? [block.text] : []
          )
        : []
    )
    .join(",");
}
