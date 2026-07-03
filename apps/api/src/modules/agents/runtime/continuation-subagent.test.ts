import { describe, expect, it, vi } from "vitest";

import { createAgentEventBus } from "../event/event-bus";
import { createInMemorySubagentRepository } from "../subagent/repository";
import { startContinuationSubagent } from "./continuation-subagent";
import { createSessionRepo } from "./test-utils";

describe("continuation subagent", () => {
  it("uses the plugin continuation agent name when starting a child agent", async () => {
    const { appendCustomMessageEntry, create, repo } = createSessionRepo();
    const subagentRepository = createInMemorySubagentRepository();
    const parentSession = await repo.create({ cwd: "/tmp/workspace" });
    const startHarness = vi.fn().mockImplementation(async (_prompt, options) => ({
      agentId: options.agentId,
      harnessSession: options.session,
      session: {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "session-2",
        path: "/sessions/session-2.jsonl"
      }
    }));

    await startContinuationSubagent({
      agentName: "reviewer",
      eventBus: createAgentEventBus(),
      parentAgentId: "agent-parent",
      parentAgentName: "main",
      parentDepth: 3,
      parentSession,
      prompt: "Review the implementation",
      sessionRepo: { create },
      startHarness,
      subagentRepository,
      subagents: new Map(),
      taskId: "task-1",
      workspacePath: "/tmp/workspace"
    });

    const [startedAgentId] = subagentRepository.findByTaskId("task-1");
    expect(startedAgentId).toEqual(expect.objectContaining({
      agentName: "reviewer",
      depth: 4
    }));
    expect(startHarness).toHaveBeenCalledWith(
      "Review the implementation",
      expect.objectContaining({ agentName: "reviewer", depth: 4 })
    );
    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "callsubagent",
      'Subagent "reviewer" is running.',
      true,
      expect.objectContaining({ agentName: "reviewer" })
    );
  });
});
