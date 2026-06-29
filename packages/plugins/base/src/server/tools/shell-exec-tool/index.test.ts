import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import {
  createShellExecTool,
  createShellKillTool,
  createShellReadTool
} from "./index";
import { classifyShellCommandRisk } from "./shell-command-risk";
import { shellProcessManager } from "./shell-process-manager";

describe("createShellExecTool", () => {
  afterEach(() => {
    shellProcessManager.clear();
    vi.useRealTimers();
  });

  it("creates the shell exec tool", () => {
    const tool = createShellExecTool(createEnv());

    expect(tool.name).toBe("shell_exec");
  });

  it("requests approval before executing write shell commands", async () => {
    const tool = createShellExecTool(createEnv());
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: {
        input: { command: "touch output.txt" }
      },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to execute the command: touch output.txt"
    );
  });

  it("requests approval before executing remove shell commands", async () => {
    const tool = createShellExecTool(createEnv());
    const requestApproval = vi.fn().mockResolvedValue(undefined);

    await tool.beforeExecute?.({
      event: {
        input: { command: "rm date_file.txt" }
      },
      requestApproval,
      workspacePath: "/workspace"
    } as ServerPlugin.ToolBeforeExecuteOptions);

    expect(requestApproval).toHaveBeenCalledWith(
      "Allowed to execute the command: rm date_file.txt"
    );
  });

  it("classifies remove shell commands as dangerous", () => {
    expect(classifyShellCommandRisk("rm date_file.txt")).toBe("dangerous");
  });

  it("returns a running shell when the wait timeout elapses and updates it after completion", async () => {
    vi.useFakeTimers();
    const env = createStreamingEnv({
      completeAfterMs: 10_000,
      stdout: "ready\n"
    });
    const tool = createShellExecTool(env, { taskId: "task-1" });
    const execution = tool.execute("tool-call-1", {
      command: "npm run dev",
      timeoutSeconds: 1
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const result = await execution;
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";

    expect(text).toContain("status: running");
    expect(text).toContain("ready");
    expect(result.details).toMatchObject({
      command: "npm run dev",
      status: "running",
      taskId: "task-1"
    });

    const shellId = (result.details as { shellId: string }).shellId;
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => {
      expect(shellProcessManager.get(shellId)).toMatchObject({
        exitCode: 0,
        status: "completed"
      });
    });
  });

  it("reads a registered shell result", async () => {
    const env = createStreamingEnv({
      completeAfterMs: 0,
      stderr: "warn\n",
      stdout: "done\n"
    });
    const execTool = createShellExecTool(env, { taskId: "task-1" });
    const execResult = await execTool.execute("tool-call-1", {
      command: "echo done",
      timeoutSeconds: 1
    });
    const shellId = (execResult.details as { shellId: string }).shellId;
    const readTool = createShellReadTool();

    const readResult = await readTool.execute("tool-call-2", { shellId });
    const text =
      readResult.content[0]?.type === "text" ? readResult.content[0].text : "";

    expect(text).toContain("status: completed");
    expect(text).toContain("stdout:");
    expect(text).toContain("done");
    expect(text).toContain("stderr:");
    expect(text).toContain("warn");
  });

  it("kills a running shell through its abort controller", async () => {
    vi.useFakeTimers();
    const env = createStreamingEnv({
      completeAfterMs: 10_000,
      stdout: "starting\n"
    });
    const execTool = createShellExecTool(env, { taskId: "task-1" });
    const execution = execTool.execute("tool-call-1", {
      command: "long-task",
      timeoutSeconds: 1
    });

    await vi.advanceTimersByTimeAsync(1_000);
    const execResult = await execution;
    const shellId = (execResult.details as { shellId: string }).shellId;
    const killTool = createShellKillTool();

    const killResult = await killTool.execute("tool-call-2", { shellId });

    expect(killResult.details).toMatchObject({
      shellId,
      status: "killed"
    });
    expect(env.abortSignals[0]?.aborted).toBe(true);
  });
});

function createEnv() {
  return {
    cwd: "/workspace"
  } as Parameters<typeof createShellExecTool>[0];
}

function createStreamingEnv(options: {
  completeAfterMs: number;
  exitCode?: number;
  stderr?: string;
  stdout?: string;
}) {
  const abortSignals: AbortSignal[] = [];

  return {
    abortSignals,
    cwd: "/workspace",
    exec: vi.fn((_, execOptions) => {
      if (execOptions?.abortSignal) {
        abortSignals.push(execOptions.abortSignal);
      }
      execOptions?.onStdout?.(options.stdout ?? "");
      execOptions?.onStderr?.(options.stderr ?? "");

      return new Promise((resolve) => {
        const complete = () => {
          if (execOptions?.abortSignal?.aborted) {
            resolve({
              error: new Error("aborted"),
              ok: false
            });
            return;
          }

          resolve({
            ok: true,
            value: {
              exitCode: options.exitCode ?? 0,
              stderr: options.stderr ?? "",
              stdout: options.stdout ?? ""
            }
          });
        };

        if (options.completeAfterMs === 0) {
          complete();
          return;
        }

        setTimeout(complete, options.completeAfterMs);
      });
    })
  } as unknown as Parameters<typeof createShellExecTool>[0] & {
    abortSignals: AbortSignal[];
  };
}
