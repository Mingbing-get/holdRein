import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../../app";
import type { AgentsService } from "../service";

function createService(overrides: Partial<AgentsService> = {}): AgentsService {
  return {
    approveAgentAction: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      approvalId: "approval-1",
      approved: true
    }),
    interruptTask: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      status: "interrupted",
      taskId: "task-1"
    }),
    getTaskTitle: vi.fn().mockResolvedValue({
      id: "task-1",
      title: "Inspect project"
    }),
    continueTask: vi.fn().mockResolvedValue({
      agentId: "agent-2",
      sessionId: "session-2",
      status: "running",
      task: { id: "task-1" },
      workspace: { id: "workspace-1" }
    }),
    deleteTask: vi.fn().mockResolvedValue({
      status: "deleted",
      taskId: "task-1"
    }),
    listTaskMessages: vi.fn().mockResolvedValue({
      messages: [
        {
          content: [{ text: "History", type: "text" }],
          id: "message-1",
          role: "user",
          timestamp: 1
        }
      ],
      subagents: [
        {
          agentId: "agent-child",
          messages: [],
          parentAgentId: "agent-1",
          status: "completed"
        }
      ]
    }),
    renameTask: vi.fn().mockResolvedValue({
      id: "task-1",
      title: "Renamed task"
    }),
    startAgent: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      sessionId: "session-1",
      status: "running",
      task: {
        createdAt: "2026-06-08T00:00:00.000Z",
        id: "task-1",
        initialUserMessage: "Inspect this project",
        lastContinuedAt: "2026-06-08T00:00:00.000Z",
        lastModelName: "gpt-4.1",
        lastModelProvider: "openai",
        lastModelProviderSource: "built_in",
        title: "",
        updatedAt: "2026-06-08T00:00:00.000Z",
        workspaceId: "workspace-1"
      },
      workspace: {
        createdAt: "2026-06-08T00:00:00.000Z",
        id: "workspace-1",
        name: "workspace",
        path: "/tmp/workspace",
        updatedAt: "2026-06-08T00:00:00.000Z"
      }
    }),
    subscribeToAgentEvents: vi.fn().mockImplementation((_input, listener) => {
      listener({
        agentId: "agent-1",
        sequence: 1,
        timestamp: "2026-06-08T00:00:00.000Z",
        type: "agent_start"
      });

      return {
        unsubscribe: vi.fn()
      };
    }),
    ...overrides
  };
}

describe("agent routes", () => {
  it("starts an agent run for a workspace path", async () => {
    const service = createService();

    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/start")
      .send({
        modelId: "gpt-4.1",
        prompt: "Inspect this project",
        provider: "openai",
        workspacePath: "/tmp/workspace"
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        agentId: "agent-1",
        sessionId: "session-1",
        status: "running",
        task: expect.objectContaining({
          id: "task-1",
          title: "",
          workspaceId: "workspace-1"
        }),
        workspace: expect.objectContaining({
          id: "workspace-1",
          path: "/tmp/workspace"
        })
      }
    });
    expect(service.startAgent).toHaveBeenCalledWith({
      modelId: "gpt-4.1",
      prompt: "Inspect this project",
      provider: "openai",
      workspacePath: "/tmp/workspace"
    });
  });

  it("rejects invalid start requests", async () => {
    const response = await request(await createApp({ agentsService: createService() }))
      .post("/api/v1/agents/start")
      .send({ prompt: "Missing required fields" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      msg: "workspacePath, provider, modelId and prompt must be strings",
      data: null
    });
  });

  it("returns stored task messages", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .get("/api/v1/agents/tasks/task-1/messages");

    expect(response.status).toBe(200);
    expect(response.body.data.messages[0]).toEqual(
      expect.objectContaining({ id: "message-1", role: "user" })
    );
    expect(response.body.data.subagents[0]).toEqual({
      agentId: "agent-child",
      messages: [],
      parentAgentId: "agent-1",
      status: "completed"
    });
    expect(service.listTaskMessages).toHaveBeenCalledWith({ taskId: "task-1" });
  });

  it("continues an existing task", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/continue")
      .send({
        modelId: "claude-3-5-sonnet",
        prompt: "Continue",
        provider: "anthropic"
      });

    expect(response.status).toBe(200);
    expect(service.continueTask).toHaveBeenCalledWith({
      modelId: "claude-3-5-sonnet",
      prompt: "Continue",
      provider: "anthropic",
      taskId: "task-1"
    });
  });

  it("continues with the previous model when model fields are omitted", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/continue")
      .send({ prompt: "Continue" });

    expect(response.status).toBe(200);
    expect(service.continueTask).toHaveBeenCalledWith({
      prompt: "Continue",
      taskId: "task-1"
    });
  });

  it("interrupts a running task", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/interrupt");

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      agentId: "agent-1",
      status: "interrupted",
      taskId: "task-1"
    });
    expect(service.interruptTask).toHaveBeenCalledWith({ taskId: "task-1" });
  });

  it("returns conflict when interrupting a task with no active run", async () => {
    const service = createService({
      interruptTask: vi.fn().mockResolvedValue({
        status: "not_running",
        taskId: "task-1"
      })
    });
    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/interrupt");

    expect(response.status).toBe(409);
    expect(response.body.msg).toBe("Task is not running");
  });

  it("rejects continue requests with only one model field", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/tasks/task-1/continue")
      .send({ prompt: "Continue", provider: "anthropic" });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe(
      "prompt must be a string and provider and modelId must both be strings when provided"
    );
    expect(service.continueTask).not.toHaveBeenCalled();
  });

  it("streams agent events as NDJSON after the requested sequence", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .get("/api/v1/agents/agent-1/events?afterSequence=7")
      .buffer(true)
      .parse((res, callback) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf8");
          (res as unknown as { destroy: () => void }).destroy();
        });
        res.on("close", () => callback(null, body));
      });

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/x-ndjson");
    expect(response.body).toBe(
      '{"agentId":"agent-1","sequence":1,"timestamp":"2026-06-08T00:00:00.000Z","type":"agent_start"}\n'
    );
    expect(service.subscribeToAgentEvents).toHaveBeenCalledWith(
      { afterSequence: 7, agentId: "agent-1" },
      expect.any(Function)
    );
  });

  it("rejects invalid event sequence cursors", async () => {
    const response = await request(await createApp({ agentsService: createService() }))
      .get("/api/v1/agents/agent-1/events?afterSequence=-1");

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe(
      "afterSequence must be a non-negative integer"
    );
  });

  it("waits for a generated task title", async () => {
    const service = createService();

    const response = await request(await createApp({ agentsService: service }))
      .get("/api/v1/agents/tasks/task-1/title");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        id: "task-1",
        title: "Inspect project"
      }
    });
    expect(service.getTaskTitle).toHaveBeenCalledWith({ taskId: "task-1" });
  });

  it("returns 404 for an unknown task title request", async () => {
    const service = createService({
      getTaskTitle: vi.fn().mockResolvedValue(null)
    });

    const response = await request(await createApp({ agentsService: service }))
      .get("/api/v1/agents/tasks/missing-task/title");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: 40400,
      msg: "Unknown task",
      data: null
    });
  });

  it("renames a task", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .patch("/api/v1/agents/tasks/task-1")
      .send({ title: " Renamed task " });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      id: "task-1",
      title: "Renamed task"
    });
    expect(service.renameTask).toHaveBeenCalledWith({
      taskId: "task-1",
      title: "Renamed task"
    });
  });

  it("rejects an empty task title", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service }))
      .patch("/api/v1/agents/tasks/task-1")
      .send({ title: "   " });

    expect(response.status).toBe(400);
    expect(service.renameTask).not.toHaveBeenCalled();
  });

  it("deletes a task", async () => {
    const service = createService();
    const response = await request(await createApp({ agentsService: service })).delete(
      "/api/v1/agents/tasks/task-1"
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ taskId: "task-1" });
    expect(service.deleteTask).toHaveBeenCalledWith({ taskId: "task-1" });
  });

  it("returns conflict when deleting a running task", async () => {
    const service = createService({
      deleteTask: vi.fn().mockResolvedValue({
        status: "running",
        taskId: "task-1"
      })
    });
    const response = await request(await createApp({ agentsService: service })).delete(
      "/api/v1/agents/tasks/task-1"
    );

    expect(response.status).toBe(409);
    expect(response.body.msg).toBe("Task is running");
  });

  it("submits an approval decision", async () => {
    const service = createService();

    const response = await request(await createApp({ agentsService: service }))
      .post("/api/v1/agents/agent-1/approvals/approval-1")
      .send({ approved: false, reason: "Use a safer command" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 0,
      msg: "ok",
      data: {
        agentId: "agent-1",
        approvalId: "approval-1",
        approved: true
      }
    });
    expect(service.approveAgentAction).toHaveBeenCalledWith({
      agentId: "agent-1",
      approvalId: "approval-1",
      approved: false,
      reason: "Use a safer command"
    });
  });

  it("rejects non-string approval reasons", async () => {
    const response = await request(await createApp({ agentsService: createService() }))
      .post("/api/v1/agents/agent-1/approvals/approval-1")
      .send({ approved: false, reason: 42 });

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe("reason must be a string");
  });
});
