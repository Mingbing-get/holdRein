import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDatabase, migrateDatabase, type AppDatabase } from "../../../db";
import { createAgentEventBus } from "../event/event-bus";
import {
  createInMemorySubagentRepository,
  createSqliteSubagentRepository
} from "../subagent/repository";
import {
  createContribution,
  createRunInput,
  createRuntime,
  createSessionRepo,
  getHarnessTool,
  subagentInput,
  toolResultMessage
} from "./test-utils";

const prompt = vi.fn().mockResolvedValue(undefined);
const harnessConstructor = vi.fn();
const harnessOn = vi.fn();
const harnessSetTools = vi.fn();
const harnessSubscribers: ((event: { message?: unknown; type: string }) => unknown)[] = [];
const tempDirectories: string[] = [];
const resolveContributions = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    skillDirs: [],
    skills: [],
    systemPrompts: [],
    tools: []
  })
);

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

vi.mock("@earendil-works/pi-agent-core/node", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();

  return {
    ...original,
    AgentHarness: class {
      interrupt = vi.fn();
      on = harnessOn;
      prompt = prompt;
      setTools = harnessSetTools;
      subscribe = vi.fn((listener: (event: { type: string }) => unknown) => {
        if (listener.constructor.name === "AsyncFunction") {
          harnessSubscribers.push(listener);
        }
        return vi.fn();
      });

      constructor(options: unknown) {
        harnessConstructor(options);
      }
    },
    NodeExecutionEnv: class {
      constructor(readonly options: unknown) {}
    },
    loadSkills: vi.fn().mockResolvedValue({ diagnostics: [], skills: [] })
  };
});

vi.mock("../../../plugin", () => ({
  pluginRegistry: {
    resolveContributions
  }
}));

describe("agent runtime subagent calls", () => {
  beforeEach(() => {
    harnessConstructor.mockClear();
    harnessOn.mockClear();
    harnessSetTools.mockClear();
    harnessSubscribers.length = 0;
    prompt.mockClear();
    prompt.mockResolvedValue(undefined);
    resolveContributions.mockClear();
    resolveContributions.mockResolvedValue(createContribution());
  });

  it("appends one visible start message per subagent in a batch call", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    const result = await runtime.start(createRunInput());
    const callMessages: string[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type !== "message_start") return;
      const payload = event.payload as {
        message?: { content?: string; customType?: string; role?: string };
      };
      if (payload.message?.role === "custom") {
        callMessages.push(payload.message.content ?? "");
      }
    });
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");

    await subagentTool?.execute?.("tool-call-1", {
      subagents: [
        { agentName: "researcher", prompt: "Inspect auth" },
        { agentName: "reviewer", prompt: "Review auth" }
      ]
    });
    await harnessSubscribers[0]?.({
      message: toolResultMessage("tool-call-1"),
      type: "message_end"
    });

    expect(prompt).toHaveBeenNthCalledWith(2, "Inspect auth");
    expect(prompt).toHaveBeenNthCalledWith(3, "Review auth");
    expect(subagentRepository.findByTaskId("task-1")).toHaveLength(2);
    expect(appendCustomMessageEntry.mock.calls.map((call) => call[1])).toEqual([
      'Subagent "researcher" is running.',
      'Subagent "reviewer" is running.'
    ]);
    expect(callMessages).toEqual([
      'Subagent "researcher" is running.',
      'Subagent "reviewer" is running.'
    ]);
  });

  it("stops exposing call_subagent after three child levels", async () => {
    const { repo } = createSessionRepo();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, createAgentEventBus(), subagentRepository);
    await runtime.start(createRunInput());

    for (let depth = 1; depth <= 3; depth += 1) {
      const callTool = getHarnessTool(harnessConstructor, "call_subagent");
      expect(callTool).toBeDefined();
      await callTool?.execute?.(`tool-call-${depth}`, {
        agentName: `child-${depth}`,
        prompt: `Start child level ${depth}`
      });
    }

    expect(getHarnessTool(harnessConstructor, "call_subagent")).toBeUndefined();
    expect(subagentRepository.findByTaskId("task-1").map((row) => row.depth))
      .toEqual([1, 2, 3]);
  });

  it("allows onAgentEnd to create a subagent beyond the model tool limit", async () => {
    const { repo } = createSessionRepo();
    const subagentRepository = createInMemorySubagentRepository();
    resolveContributions.mockResolvedValue(createContribution({
      onAgentEnd: vi.fn().mockResolvedValue({
        agentName: "continuation",
        prompt: "Continue outside the model tool path",
        useSubagent: true
      })
    }));
    const runtime = createRuntime(repo, createAgentEventBus(), subagentRepository);
    await runtime.start(createRunInput());

    for (let depth = 1; depth <= 3; depth += 1) {
      await getHarnessTool(harnessConstructor, "call_subagent")?.execute?.(
        `tool-call-${depth}`,
        { agentName: `child-${depth}`, prompt: `Start child level ${depth}` }
      );
    }
    await harnessSubscribers[3]?.({ type: "agent_end" });

    expect(subagentRepository.findByTaskId("task-1").map((row) => row.depth))
      .toEqual([1, 2, 3, 4]);
    expect(prompt).toHaveBeenLastCalledWith("Continue outside the model tool path");
    expect(getHarnessTool(harnessConstructor, "call_subagent")).toBeUndefined();
  });

  it("defers completed subagent results while the parent harness is running", async () => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    const runtime = createRuntime(repo, eventBus, subagentRepository);
    let resolveParentPrompt: (() => void) | undefined;
    prompt.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveParentPrompt = resolve;
    }));
    const result = await runtime.start(createRunInput());
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    const callResult = await subagentTool?.execute?.(
      "tool-call-1",
      subagentInput()
    ) as { details?: { agentId?: string } } | undefined;
    const childAgentId = callResult?.details?.agentId ?? "";

    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "The auth module is isolated.", type: "text" }],
        role: "assistant",
        timestamp: 2
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });

    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      "subagent_result",
      expect.anything(),
      true,
      expect.anything()
    );
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(subagentRepository.findByAgentId(childAgentId)?.status)
      .toBe("completed");

    await harnessSubscribers[0]?.({
      message: toolResultMessage("tool-call-1"),
      type: "message_end"
    });

    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "subagent_result",
      expect.stringContaining("The auth module is isolated."),
      true,
      expect.objectContaining({ agentId: childAgentId, agentName: "researcher" })
    );
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(result.agentId).toMatch(/^agent_/);
    resolveParentPrompt?.();
  });

  it("starts plugin continuation prompts in a named subagent when requested", async () => {
    const { appendCustomMessageEntry, create, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    resolveContributions.mockResolvedValue(createContribution({
      onAgentEnd: vi.fn().mockResolvedValue({
        agentName: "reviewer",
        details: { source: "test-plugin" },
        prompt: "Run this follow-up separately",
        useSubagent: true
      })
    }));
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    const result = await runtime.start(createRunInput());
    const callMessages: { content?: string; customType?: string; details?: unknown }[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      if (event.type !== "message_start") return;
      const payload = event.payload as {
        message?: { content?: string; customType?: string; details?: unknown };
      };
      if (payload.message?.customType) {
        callMessages.push(payload.message);
      }
    });
    await harnessSubscribers[0]?.({ type: "agent_end" });

    const childRows = subagentRepository.findByTaskId("task-1");
    expect(childRows).toHaveLength(1);
    expect(childRows[0]).toEqual(expect.objectContaining({
      agentName: "reviewer",
      parentAgentId: result.agentId,
      sessionId: "session-2",
      status: "running"
    }));
    expect(appendCustomMessageEntry).toHaveBeenCalledWith(
      "callsubagent",
      'Subagent "reviewer" is running.',
      true,
      expect.objectContaining({
        agentName: "reviewer",
        parentAgentId: result.agentId,
        session: expect.objectContaining({ id: "session-2" }),
        taskId: "task-1"
      })
    );
    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      "agent_continuation",
      expect.anything(),
      true,
      expect.anything()
    );
    expect(callMessages).toEqual([
      expect.objectContaining({
        content: 'Subagent "reviewer" is running.',
        customType: "callsubagent",
        details: expect.objectContaining({
          agentName: "reviewer",
          parentAgentId: result.agentId,
          session: expect.objectContaining({ id: "session-2" }),
          taskId: "task-1"
        })
      })
    ]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(prompt).toHaveBeenNthCalledWith(2, "Run this follow-up separately");
    expect(harnessConstructor.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
      activeToolNames: expect.arrayContaining(["call_subagent"])
    }));
    expect(resolveContributions.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        agentName: "reviewer"
      })
    );
  });

  it.each([
    { customType: "agent_continuation", mode: "direct", useSubagent: false },
    { customType: "callsubagent", mode: "subagent", useSubagent: true }
  ])("does not start plugin $mode continuations after manual interrupt", async ({
    customType,
    useSubagent
  }) => {
    const { appendCustomMessageEntry, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const subagentRepository = createInMemorySubagentRepository();
    let resolvePrompt: (() => void) | undefined;
    const onAgentEnd = vi.fn().mockResolvedValue({
      details: { source: "test-plugin" },
      prompt: "Run this follow-up separately",
      useSubagent
    });
    resolveContributions.mockResolvedValue(createContribution({ onAgentEnd }));
    prompt.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolvePrompt = resolve;
    }));
    const runtime = createRuntime(repo, eventBus, subagentRepository);

    const result = await runtime.start(createRunInput());
    await expect(runtime.interrupt(result.agentId)).resolves.toBe(true);
    await harnessSubscribers[0]?.({ type: "agent_end" });

    expect(onAgentEnd).not.toHaveBeenCalled();
    expect(subagentRepository.findByTaskId("task-1")).toEqual([]);
    expect(appendCustomMessageEntry).not.toHaveBeenCalledWith(
      customType,
      expect.anything(),
      true,
      expect.anything()
    );
    expect(prompt).toHaveBeenCalledTimes(1);
    resolvePrompt?.();
  });

  it("adds a revoke tool to the parent harness after a subagent completes", async () => {
    const { repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const { database, subagentRepository } = createSubagentDatabaseFixture();
    const runtime = createRuntime(repo, eventBus, subagentRepository, database);
    let resolveParentPrompt: (() => void) | undefined;
    prompt.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveParentPrompt = resolve;
    }));
    const result = await runtime.start(createRunInput());
    const parentOptions = harnessConstructor.mock.calls[0]?.[0] as {
      tools?: { execute?: (toolCallId: string, input: unknown) => unknown; name: string }[];
    };
    expect(parentOptions.tools?.map((tool) => tool.name)).toEqual([
      "call_subagent"
    ]);
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    const callResult = await subagentTool?.execute?.(
      "tool-call-1",
      subagentInput()
    ) as { details?: { agentId?: string } } | undefined;
    const childAgentId = callResult?.details?.agentId ?? "";

    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "First pass complete.", type: "text" }],
        role: "assistant",
        timestamp: 2
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });
    await harnessSubscribers[1]?.({ type: "agent_end" });

    const revokeTool = parentOptions.tools?.find(
      (tool) => tool.name === "revoke_subagent"
    );
    expect(revokeTool).toBeDefined();
    expect(harnessSetTools).toHaveBeenCalledTimes(1);
    expect(harnessSetTools).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "revoke_subagent" })]),
      expect.arrayContaining(["call_subagent", "revoke_subagent"])
    );

    await expect(revokeTool?.execute?.("tool-call-2", {
      agentId: "agent_missing",
      prompt: "Try again"
    })).rejects.toThrow("Unknown completed subagent: agent_missing");
    await expect(revokeTool?.execute?.("tool-call-3", {
      agentId: childAgentId,
      prompt: "Inspect one more case"
    })).resolves.toEqual({
      content: [{
        text: `Subagent "researcher" was revoked. agentId=${childAgentId}`,
        type: "text"
      }],
      details: expect.objectContaining({
        agentId: childAgentId,
        parentAgentId: result.agentId
      })
    });
    expect(prompt).toHaveBeenLastCalledWith("Inspect one more case");
    expect(subagentRepository.findByAgentId(childAgentId)?.status)
      .toBe("running");
    resolveParentPrompt?.();
  });

  it("adds a revoke tool for restored parent sessions with call subagent history", async () => {
    const { open, repo } = createSessionRepo();
    const runtime = createRuntime(repo);
    open.mockResolvedValueOnce({
      appendCustomMessageEntry: vi.fn(),
      buildContext: vi.fn().mockResolvedValue({
        messages: [{
          content: 'Subagent "researcher" is running.',
          customType: "callsubagent",
          details: { agentId: "agent-child" },
          display: true,
          role: "custom",
          timestamp: 1
        }],
        model: null,
        thinkingLevel: "off"
      }),
      getMetadata: vi.fn().mockResolvedValue({
        createdAt: "2026-06-11T00:00:00.000Z",
        cwd: "/tmp/workspace",
        id: "session-parent",
        path: "/sessions/session-parent.jsonl"
      })
    } as never);

    await runtime.start({
      ...createRunInput(),
      session: {
        createdAt: "2026-06-11T00:00:00.000Z",
        id: "session-parent",
        path: "/sessions/session-parent.jsonl"
      }
    });

    const parentOptions = harnessConstructor.mock.calls[0]?.[0] as {
      activeToolNames?: string[];
      tools?: { name: string }[];
    };
    expect(parentOptions.tools?.map((tool) => tool.name)).toContain(
      "revoke_subagent"
    );
    expect(parentOptions.activeToolNames).toContain("revoke_subagent");
  });

  it("revokes a completed subagent from persisted session metadata and emits a resubscribe event", async () => {
    const { appendCustomMessageEntry, open, repo } = createSessionRepo();
    const eventBus = createAgentEventBus();
    const { database, subagentRepository } = createSubagentDatabaseFixture();
    const runtime = createRuntime(repo, eventBus, subagentRepository, database);
    const result = await runtime.start(createRunInput());
    const parentEvents: { payload?: unknown; type: string }[] = [];
    eventBus.subscribe({ agentId: result.agentId }, (event) => {
      parentEvents.push({ payload: event.payload, type: event.type });
    });
    const parentOptions = harnessConstructor.mock.calls[0]?.[0] as {
      tools?: { execute?: (toolCallId: string, input: unknown) => unknown; name: string }[];
    };
    const subagentTool = getHarnessTool(harnessConstructor, "call_subagent");
    const callResult = await subagentTool?.execute?.(
      "tool-call-1",
      subagentInput()
    ) as { details?: { agentId?: string } } | undefined;
    const childAgentId = callResult?.details?.agentId ?? "";

    await harnessSubscribers[1]?.({
      message: {
        content: [{ text: "First pass complete.", type: "text" }],
        role: "assistant",
        timestamp: 2
      },
      type: "message_end"
    });
    await harnessSubscribers[1]?.({ type: "agent_end" });
    await harnessSubscribers[0]?.({
      message: toolResultMessage("tool-call-1"),
      type: "message_end"
    });
    database.sqlite.prepare(
      "UPDATE subagents SET depth = 3 WHERE agent_id = ?"
    ).run(childAgentId);
    const appendCountBeforeRevoke = appendCustomMessageEntry.mock.calls.length;
    const revokeTool = parentOptions.tools?.find(
      (tool) => tool.name === "revoke_subagent"
    );

    await revokeTool?.execute?.("tool-call-2", {
      agentId: childAgentId,
      prompt: "Inspect one more case"
    });

    expect(open).toHaveBeenCalledWith({
      createdAt: "2026-06-11T00:00:00.000Z",
      cwd: "/tmp/workspace",
      id: "session-2",
      path: "/sessions/session-2.jsonl"
    });
    expect(appendCustomMessageEntry).toHaveBeenCalledTimes(appendCountBeforeRevoke);
    expect(getHarnessTool(harnessConstructor, "call_subagent")).toBeUndefined();
    expect(parentEvents).toContainEqual({
      type: "subagent_resumed",
      payload: expect.objectContaining({
        agentId: childAgentId,
        agentName: "researcher",
        parentAgentId: result.agentId,
        session: expect.objectContaining({ id: "session-2" }),
        taskId: "task-1"
      })
    });
  });
});

function createSubagentDatabaseFixture(): {
  database: AppDatabase;
  subagentRepository: ReturnType<typeof createSqliteSubagentRepository>;
} {
  const directory = mkdtempSync(join(tmpdir(), "hold-rein-runtime-subagents-"));
  tempDirectories.push(directory);
  const database = createDatabase(join(directory, "test.sqlite"));
  migrateDatabase(database.sqlite);
  database.sqlite.exec(`
    INSERT INTO workspaces (id, name, path, created_at, updated_at)
    VALUES ('workspace-1', 'Workspace', '/tmp/workspace', 'now', 'now');
    INSERT INTO tasks (
      id, workspace_id, title, initial_user_message,
      last_model_provider_source, last_model_provider, last_model_name,
      created_at, updated_at
    ) VALUES (
      'task-1', 'workspace-1', 'Task', 'Prompt',
      'built_in', 'openai', 'gpt-4.1', 'now', 'now'
    );
  `);

  return {
    database,
    subagentRepository: createSqliteSubagentRepository(database)
  };
}
