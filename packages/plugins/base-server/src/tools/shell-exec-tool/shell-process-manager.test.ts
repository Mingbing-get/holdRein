import { describe, expect, it } from "vitest";

import { ShellProcessManager } from "./shell-process-manager";

describe("ShellProcessManager", () => {
  it("kills running shell processes for a task and keeps other tasks running", () => {
    const manager = new ShellProcessManager();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = manager.register({
      command: "npm run dev",
      controller: firstController,
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });
    const second = manager.register({
      command: "npm test",
      controller: secondController,
      cwd: "/workspace",
      taskId: "task-2",
      toolCallId: "tool-call-2"
    });

    const killed = manager.killByTask("task-1");

    expect(killed).toHaveLength(1);
    expect(manager.get(first.id)).toMatchObject({ status: "killed" });
    expect(manager.get(second.id)).toMatchObject({ status: "running" });
    expect(firstController.signal.aborted).toBe(true);
    expect(secondController.signal.aborted).toBe(false);
  });

  it("kills and removes all shell processes for a task", () => {
    const manager = new ShellProcessManager();
    const runningController = new AbortController();
    const otherController = new AbortController();
    const running = manager.register({
      command: "npm run dev",
      controller: runningController,
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });
    const completed = manager.register({
      command: "npm test",
      controller: new AbortController(),
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-2"
    });
    const other = manager.register({
      command: "npm run build",
      controller: otherController,
      cwd: "/workspace",
      taskId: "task-2",
      toolCallId: "tool-call-3"
    });

    manager.complete(completed.id, 0);

    const removed = manager.killAndRemoveByTask("task-1");

    expect(removed).toEqual([
      expect.objectContaining({ id: running.id, status: "killed" }),
      expect.objectContaining({ id: completed.id, status: "completed" })
    ]);
    expect(manager.get(running.id)).toBeUndefined();
    expect(manager.get(completed.id)).toBeUndefined();
    expect(manager.get(other.id)).toMatchObject({ status: "running" });
    expect(runningController.signal.aborted).toBe(true);
    expect(otherController.signal.aborted).toBe(false);
  });
});
