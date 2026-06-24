import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import baseServerPlugin from "./index";
import { shellProcessManager } from "./tools/shell-exec-tool/shell-process-manager";

const CLEANUP_DELAY_MS = 60 * 60 * 1000;

describe("baseServerPlugin", () => {
  afterEach(() => {
    shellProcessManager.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("kills and removes task shells one hour after the main agent ends", async () => {
    vi.useFakeTimers();
    const contribution = await resolveContribution("main", "task-1");
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = shellProcessManager.register({
      command: "npm run dev",
      controller: firstController,
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });
    const second = shellProcessManager.register({
      command: "npm test",
      controller: secondController,
      cwd: "/workspace",
      taskId: "task-2",
      toolCallId: "tool-call-2"
    });

    await contribution.onAgentEnd?.(createAgentEndInput("task-1"));
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS - 1);

    expect(shellProcessManager.get(first.id)).toMatchObject({
      status: "running"
    });
    expect(firstController.signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(shellProcessManager.get(first.id)).toBeUndefined();
    expect(shellProcessManager.get(second.id)).toMatchObject({
      status: "running"
    });
    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(false);
  });

  it("resets the existing task cleanup timer when the main agent ends again", async () => {
    vi.useFakeTimers();
    const contribution = await resolveContribution("main", "task-1");
    const controller = new AbortController();
    const record = shellProcessManager.register({
      command: "npm run dev",
      controller,
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });

    await contribution.onAgentEnd?.(createAgentEndInput("task-1"));
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS / 2);
    await contribution.onAgentEnd?.(createAgentEndInput("task-1"));
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS / 2);

    expect(shellProcessManager.get(record.id)).toMatchObject({
      status: "running"
    });
    expect(controller.signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS / 2);

    expect(shellProcessManager.get(record.id)).toBeUndefined();
    expect(controller.signal.aborted).toBe(true);
  });

  it("does not schedule task shell cleanup for non-main agents", async () => {
    vi.useFakeTimers();
    const contribution = await resolveContribution("worker", "task-1");
    const controller = new AbortController();
    const record = shellProcessManager.register({
      command: "npm run dev",
      controller,
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });

    await contribution.onAgentEnd?.(createAgentEndInput("task-1"));
    await vi.advanceTimersByTimeAsync(CLEANUP_DELAY_MS);

    expect(shellProcessManager.get(record.id)).toMatchObject({
      status: "running"
    });
    expect(controller.signal.aborted).toBe(false);
  });
});

async function resolveContribution(
  agentName: string,
  taskId: string
): Promise<ServerPlugin.Contribution> {
  const resolver = baseServerPlugin.contributionResolver;

  if (typeof resolver !== "function") {
    throw new Error("Expected dynamic contribution resolver");
  }

  return resolver({
    agentName,
    env: { cwd: "/workspace" } as ServerPlugin.RuntimeContext["env"],
    isContinue: false,
    model: {} as ServerPlugin.RuntimeContext["model"],
    prompt: "Run task",
    session: {} as ServerPlugin.RuntimeContext["session"],
    taskId,
    thinkingLevel: "medium"
  });
}

function createAgentEndInput(taskId: string): ServerPlugin.AgentEndInput {
  return {
    messages: [],
    runInput: {
      modelId: "gpt-5",
      prompt: "Run task",
      provider: "openai",
      taskId,
      workspacePath: "/workspace"
    },
    session: {
      createdAt: "now",
      id: "session-1",
      path: "/sessions/session-1.jsonl"
    }
  };
}
