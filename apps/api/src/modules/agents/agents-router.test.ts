import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app";
import type { AgentsService } from "./agents-service";

function createService(overrides: Partial<AgentsService> = {}): AgentsService {
  return {
    approveAgentAction: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      approvalId: "approval-1",
      approved: true
    }),
    startAgent: vi.fn().mockResolvedValue({
      agentId: "agent-1",
      sessionId: "session-1",
      status: "running"
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

    const response = await request(createApp({ agentsService: service }))
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
        status: "running"
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
    const response = await request(createApp({ agentsService: createService() }))
      .post("/api/v1/agents/start")
      .send({ prompt: "Missing required fields" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: 40000,
      msg: "workspacePath, provider, modelId and prompt must be strings",
      data: null
    });
  });

  it("streams agent events as NDJSON after the requested sequence", async () => {
    const service = createService();
    const response = await request(createApp({ agentsService: service }))
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
    const response = await request(createApp({ agentsService: createService() }))
      .get("/api/v1/agents/agent-1/events?afterSequence=-1");

    expect(response.status).toBe(400);
    expect(response.body.msg).toBe(
      "afterSequence must be a non-negative integer"
    );
  });

  it("submits an approval decision", async () => {
    const service = createService();

    const response = await request(createApp({ agentsService: service }))
      .post("/api/v1/agents/agent-1/approvals/approval-1")
      .send({ approved: false });

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
      approved: false
    });
  });
});
