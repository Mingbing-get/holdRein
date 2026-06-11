// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("resumes a running task subscription and marks an unseen completion", async () => {
    const fetcher = createResumedTaskFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <ResumedTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resumed-task-status")).toHaveTextContent(
        "completed"
      );
      expect(screen.getByTestId("unread-completion")).toHaveTextContent("true");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-resumed/events",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    fireEvent.click(screen.getByRole("button", { name: "查看任务" }));

    await waitFor(() => {
      expect(screen.getByTestId("unread-completion")).toHaveTextContent("false");
    });
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
          ?.messages.map((message) => message.role)
          .join(",")}
      </span>
    </>
  );
}

function ResumedTaskProbe() {
  const {
    state: { workspaces },
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();
  const { hasUnreadCompletion } = useAgentTasks();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "workspace",
        path: "/workspace",
        tasks: [
          {
            activeAgentId: "agent-resumed",
            id: "task-resumed",
            initialUserMessage: "Inspect",
            lastContinuedAt: "2026-06-11T00:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "running",
            title: "Inspect"
          }
        ]
      }
    ]);
    setActiveWorkspaceId("workspace-1");
    setActiveTaskId("another-task");
  }, [setActiveTaskId, setActiveWorkspaceId, setWorkspaces]);

  return (
    <>
      <span data-testid="resumed-task-status">
        {workspaces[0]?.tasks[0]?.status}
      </span>
      <span data-testid="unread-completion">
        {String(hasUnreadCompletion("task-resumed"))}
      </span>
      <button onClick={() => setActiveTaskId("task-resumed")}>查看任务</button>
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
          status: "running",
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
              '{"agentId":"agent-1","payload":{"message":{"id":"message-1","role":"assistant","content":[],"api":"openai-responses","provider":"openai","model":"gpt-4.1","stopReason":"stop","timestamp":1}},"sequence":1,"timestamp":"now","type":"message_start"}\n'
            )
          );
          controller.close();
        }
      }),
      { status: 200 }
    );
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function createResumedTaskFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/messages")) {
      return jsonResponse([]);
    }

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              '{"agentId":"agent-resumed","sequence":1,"timestamp":"now","type":"agent_end"}\n'
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
