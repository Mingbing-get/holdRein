import { describe, expect, it, vi } from "vitest";

import {
  fetchTaskTitle,
  startAgentTask,
  subscribeToAgentEvents
} from "./agent-message-api";

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
        modelId: "gpt-4.1",
        prompt: "Inspect this project",
        provider: "openai",
        workspacePath: "/workspace"
      },
      fetcher
    );

    expect(fetcher).toHaveBeenCalledWith(
      "http://localhost:4000/api/v1/agents/start",
      expect.objectContaining({
        body: JSON.stringify({
          modelId: "gpt-4.1",
          prompt: "Inspect this project",
          provider: "openai",
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
});
