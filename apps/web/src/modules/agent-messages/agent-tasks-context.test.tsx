// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppWorkspaceProvider, useAppWorkspace } from "../../app/app-workspace-context";
import type { AgentMessageFetcher } from "./agent-message-api";
import { AgentTasksProvider, useAgentTasks } from "./agent-tasks-context";
import { jsonResponse, startResult, streamResponse } from "./agent-tasks-context-test-utils";

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

  it("keeps a resumed task running when only the agent run ends", async () => {
    const fetcher = createResumedTaskFetcher("agent_end");

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <ResumedTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resumed-task-status")).toHaveTextContent(
        "running"
      );
      expect(screen.getByTestId("unread-completion")).toHaveTextContent("false");
    });
  });

  it("subscribes to a subagent announced by a custom message", async () => {
    const fetcher = createSubagentFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <StartTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-child/events",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ));
  });

  it("submits and removes a pending approval", async () => {
    const fetcher = createApprovalFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <ApprovalProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent(
        "approval-1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "拒绝审批" }));

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent("none");
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-approval/approvals/approval-1",
      expect.objectContaining({
        body: JSON.stringify({ approved: false, reason: "Not now" })
      })
    );
  });

  it("keeps a pending approval when submission fails", async () => {
    const fetcher = createApprovalFetcher(true);

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <ApprovalProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pending-approval")).toHaveTextContent(
        "approval-1"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "拒绝审批" }));

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/agents/agent-approval/approvals/approval-1",
        expect.anything()
      );
    });
    expect(screen.getByTestId("pending-approval")).toHaveTextContent(
      "approval-1"
    );
  });

  it("cancels a running task and updates workspace task status", async () => {
    const fetcher = createCancelFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <CancelProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("cancel-task-status")).toHaveTextContent(
        "running"
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "中断任务" }));

    await waitFor(() => {
      expect(screen.getByTestId("cancel-task-status")).toHaveTextContent(
        "error"
      );
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/tasks/task-cancel/interrupt",
      expect.objectContaining({ method: "POST" })
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

function ApprovalProbe() {
  const { setWorkspaces } = useAppWorkspace();
  const { decideApproval, getPendingApproval } = useAgentTasks();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "workspace",
        path: "/workspace",
        tasks: [
          {
            activeAgentId: "agent-approval",
            id: "task-approval",
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
  }, [setWorkspaces]);

  const approval = getPendingApproval("task-approval");
  return (
    <>
      <span data-testid="pending-approval">{approval?.approvalId ?? "none"}</span>
      <button
        onClick={() =>
          void decideApproval(
            "task-approval",
            "approval-1",
            false,
            "Not now"
          ).catch(() => undefined)
        }
      >
        拒绝审批
      </button>
    </>
  );
}

function CancelProbe() {
  const {
    state: { workspaces },
    setWorkspaces
  } = useAppWorkspace();
  const { cancelTask } = useAgentTasks();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "workspace",
        path: "/workspace",
        tasks: [
          {
            activeAgentId: "agent-cancel",
            id: "task-cancel",
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
  }, [setWorkspaces]);

  return (
    <>
      <span data-testid="cancel-task-status">
        {workspaces[0]?.tasks[0]?.status}
      </span>
      <button onClick={() => void cancelTask("task-cancel")}>中断任务</button>
    </>
  );
}

function createAgentFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
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

function createResumedTaskFetcher(
  terminalEvent = "task_end"
): AgentMessageFetcher & ReturnType<typeof vi.fn> {
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
              `{"agentId":"agent-resumed","sequence":1,"timestamp":"now","type":"${terminalEvent}"}\n`
            )
          );
          controller.close();
        }
      }),
      { status: 200 }
    );
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function createSubagentFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
    }
    if (url.endsWith("/title")) return jsonResponse({ id: "task-1", title: "Project inspection" });
    return streamResponse((controller) => {
      if (url.includes("agent-1/events")) {
        controller.enqueue(encoder.encode(
          '{"agentId":"agent-1","payload":{"message":{"content":"Subagent is running","customType":"callsubagent","details":{"agentId":"agent-child","session":{"id":"session-child"}},"display":true,"id":"message-subagent","role":"custom","timestamp":1}},"sequence":1,"timestamp":"now","type":"message_start"}\n'
        ));
      }
    });
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function createApprovalFetcher(
  failDecision = false
): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/approvals/approval-1")) {
      if (failDecision) {
        return new Response(null, { status: 500 });
      }
      return jsonResponse({
        agentId: "agent-approval",
        approvalId: "approval-1",
        approved: false
      });
    }
    if (url.endsWith("/messages")) {
      return jsonResponse([]);
    }
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              '{"agentId":"agent-approval","payload":{"agentId":"agent-approval","approvalId":"approval-1","tool":{"input":{},"name":"workspace_patch","toolCallId":"tool-call-1"}},"sequence":1,"timestamp":"now","type":"approval_requested"}\n'
            )
          );
          controller.close();
        }
      }),
      { status: 200 }
    );
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}

function createCancelFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/messages")) {
      return jsonResponse([]);
    }
    if (url.endsWith("/interrupt")) {
      return jsonResponse({
        agentId: "agent-cancel",
        status: "interrupted",
        taskId: "task-cancel"
      });
    }

    return new Response(
      new ReadableStream({
        start() {
          // Keep the resumed subscription open until the provider aborts it.
        }
      }),
      { status: 200 }
    );
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}
