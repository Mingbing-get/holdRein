import { describe, expect, it, vi } from "vitest";

import {
  cancelAgentTask,
  continueAgentTask,
  decideAgentApproval,
  fetchTaskMessages,
  fetchTaskTitle,
  startAgentTask,
  subscribeToAgentEvents
} from ".";

describe("agent message API", () => {
  it("starts an agent task with the selected workspace and model", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: {
          agentId: "agent-1",
          sessionId: "session-1",
          status: "running",
          task: { id: "task-1" },
          workspace: { id: "workspace-1" }
        },
        msg: "ok"
      }),
      ok: true
    });

    await startAgentTask(
      "http://localhost:4000/",
      {
        approvalPolicy: "run_all",
        modelId: "gpt-4.1",
        prompt: "Inspect this project",
        provider: "openai",
        thinkingLevel: "high",
        workspacePath: "/workspace"
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/agents/start",
      expect.objectContaining({
        body: JSON.stringify({
          approvalPolicy: "run_all",
          modelId: "gpt-4.1",
          prompt: "Inspect this project",
          provider: "openai",
          thinkingLevel: "high",
          workspacePath: "/workspace"
        }),
        method: "POST"
      })
    );
  });

  it("fetches a generated task title", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: { id: "task-1", title: "Inspect project" },
        msg: "ok"
      }),
      ok: true
    });

    await expect(
      fetchTaskTitle("http://localhost:4000", "task-1", fetcher)
    ).resolves.toEqual({ id: "task-1", title: "Inspect project" });
  });

  it("fetches stored messages and continues an existing task", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            messages: [
              { content: "History", id: "message-1", role: "user", timestamp: 1 }
            ],
            subagents: [
              {
                agentId: "agent-child",
                messages: [],
                parentAgentId: "agent-1",
                status: "completed"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      })
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { agentId: "agent-2", sessionId: "session-2", status: "running" },
          msg: "ok"
        }),
        ok: true
      });

    await expect(fetchTaskMessages("", "task-1", fetcher)).resolves.toEqual({
      messages: [
        { content: "History", id: "message-1", role: "user", timestamp: 1 }
      ],
      subagents: [
        {
          agentId: "agent-child",
          messages: [],
          parentAgentId: "agent-1",
          status: "completed"
        }
      ]
    });
    await continueAgentTask(
      "",
      "task-1",
      {
        approvalPolicy: "approval",
        modelId: "claude-3-5-sonnet",
        prompt: "Continue",
        provider: "anthropic",
        thinkingLevel: "medium"
      },
      fetcher
    );

    expect(fetcher).toHaveBeenLastCalledWith(
      "/api/v1/agents/tasks/task-1/continue",
      expect.objectContaining({
        body: JSON.stringify({
          approvalPolicy: "approval",
          modelId: "claude-3-5-sonnet",
          prompt: "Continue",
          provider: "anthropic",
          thinkingLevel: "medium"
        }),
        method: "POST"
      })
    );
  });

  it("interrupts an active task", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: {
          agentId: "agent-1",
          status: "interrupted",
          taskId: "task-1"
        },
        msg: "ok"
      }),
      ok: true
    });

    await expect(cancelAgentTask("", "task-1", fetcher)).resolves.toEqual({
      agentId: "agent-1",
      status: "interrupted",
      taskId: "task-1"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/tasks/task-1/interrupt",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("parses NDJSON events split across response chunks", async () => {
    const encoder = new TextEncoder();
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              '{"agentId":"agent-1","sequence":1,"timestamp":"now","type":"message_'
            )
          );
          controller.enqueue(
            encoder.encode(
              'update","payload":{"delta":"hello"}}\n{"agentId":"agent-1","sequence":2,"timestamp":"now","type":"turn_end"}\n'
            )
          );
          controller.close();
        }
      }),
      { status: 200 }
    );
    const listener = vi.fn();

    await subscribeToAgentEvents(
      "http://localhost:4000",
      { agentId: "agent-1", afterSequence: 0 },
      listener,
      vi.fn().mockResolvedValue(response)
    );

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ sequence: 2, type: "turn_end" })
    );
  });

  it("subscribes with a relative URL when the API base URL is empty", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.close();
        }
      }),
      { status: 200 }
    );
    const fetcher = vi.fn().mockResolvedValue(response);

    await subscribeToAgentEvents(
      "",
      { agentId: "agent-1", afterSequence: 0 },
      vi.fn(),
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-1/events?afterSequence=0",
      {}
    );
  });

  it("submits approval decisions with an optional rejection reason", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      json: async () => ({
        code: 0,
        data: { agentId: "agent-1", approvalId: "approval-1", approved: false },
        msg: "ok"
      }),
      ok: true
    });

    await decideAgentApproval(
      "",
      {
        agentId: "agent-1",
        approvalId: "approval-1",
        approved: false,
        reason: "Use a safer command"
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/v1/agents/agent-1/approvals/approval-1",
      expect.objectContaining({
        body: JSON.stringify({
          approved: false,
          reason: "Use a safer command"
        }),
        method: "POST"
      })
    );
  });
});
