import { describe, expect, it, vi } from "vitest";

import { ShellProcessManager } from "./shell-process-manager";

describe("ShellProcessManager", () => {
  it("notifies subscribers as shell processes stream output and end", () => {
    const manager = new ShellProcessManager();
    const listener = vi.fn();
    const unsubscribe = manager.subscribe(listener);

    const record = manager.register({
      command: "npm run dev",
      controller: new AbortController(),
      cwd: "/workspace",
      taskId: "task-1",
      toolCallId: "tool-call-1"
    });
    manager.appendStdout(record.id, "ready\n");
    manager.appendStderr(record.id, "warn\n");
    manager.complete(record.id, 0);
    unsubscribe();
    manager.appendStdout(record.id, "ignored\n");

    expect(listener).toHaveBeenCalledTimes(4);
    expect(listener).toHaveBeenNthCalledWith(1, {
      record,
      type: "shell_start"
    });
    expect(listener).toHaveBeenNthCalledWith(2, {
      chunk: "ready\n",
      record: expect.objectContaining({ id: record.id, stdout: "ready\n" }),
      type: "shell_stdout"
    });
    expect(listener).toHaveBeenNthCalledWith(3, {
      chunk: "warn\n",
      record: expect.objectContaining({ id: record.id, stderr: "warn\n" }),
      type: "shell_stderr"
    });
    expect(listener).toHaveBeenNthCalledWith(4, {
      record: expect.objectContaining({
        exitCode: 0,
        id: record.id,
        status: "completed"
      }),
      type: "shell_end"
    });
  });

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
