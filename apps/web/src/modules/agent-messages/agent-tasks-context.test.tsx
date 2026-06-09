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

describe("AgentTasksProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts, subscribes, and updates the generated navigation title", async () => {
    const fetcher = createAgentFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <StartTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("task-title")).toHaveTextContent(
        "Project inspection"
      );
      expect(screen.getByTestId("task-message-kinds")).toHaveTextContent(
        "user,assistant"
      );
    });

    expect(screen.getByTestId("active-task-id")).toHaveTextContent("task-1");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-1/events",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

function StartTaskProbe() {
  const {
    state: { activeTaskId, workspaces }
  } = useAppWorkspace();
  const { getTaskState, startTask } = useAgentTasks();

  useEffect(() => {
    void startTask({
      modelId: "gpt-4.1",
      prompt: "Inspect the project",
      provider: "openai",
      workspacePath: "/workspace"
    });
  }, [startTask]);

  return (
    <>
      <span data-testid="active-task-id">{activeTaskId}</span>
      <span data-testid="task-title">{workspaces[0]?.tasks[0]?.title}</span>
      <span data-testid="task-message-kinds">
        {getTaskState("task-1")
          ?.messages.map((message) => message.kind)
          .join(",")}
      </span>
    </>
  );
}

function createAgentFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse({
        agentId: "agent-1",
        sessionId: "session-1",
        status: "running",
        task: {
          id: "task-1",
          initialUserMessage: "Inspect the project",
          lastContinuedAt: "2026-06-08T00:00:00.000Z",
          lastModelName: "gpt-4.1",
          lastModelProvider: "openai",
          lastModelProviderSource: "built_in",
          title: "",
          workspaceId: "workspace-1"
        },
        workspace: {
          id: "workspace-1",
          name: "workspace",
          path: "/workspace"
        }
      });
    }

    if (url.endsWith("/api/v1/agents/tasks/task-1/title")) {
      return jsonResponse({ id: "task-1", title: "Project inspection" });
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              '{"agentId":"agent-1","payload":{"delta":"Done"},"sequence":1,"timestamp":"now","type":"message_update"}\n'
            )
          );
          controller.close();
        }
      }),
      { status: 200 }
    );
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ code: 0, data, msg: "ok" }), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}
