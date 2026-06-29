import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { classifyShellCommandRisk } from "./shell-command-risk";
import {
  shellProcessManager,
  type ShellProcessRecord
} from "./shell-process-manager";

const MAX_OUTPUT_LENGTH = 20_000;
const DEFAULT_WAIT_TIMEOUT_SECONDS = 60;

const shellExecParameters = Type.Object({
  command: Type.String({ description: "Shell command to execute." }),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for the command." })
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({ description: "Command timeout in seconds." })
  )
});

type ShellExecParameters = Static<typeof shellExecParameters>;

const shellReadParameters = Type.Object({
  shellId: Type.String({ description: "Registered shell command id." })
});

type ShellReadParameters = Static<typeof shellReadParameters>;

const shellKillParameters = Type.Object({
  shellId: Type.String({ description: "Registered shell command id." })
});

type ShellKillParameters = Static<typeof shellKillParameters>;

interface CreateShellExecToolOptions {
  readonly taskId?: string;
}

export function createShellExecTool(
  env: ExecutionEnv,
  options: CreateShellExecToolOptions = {}
): ServerPlugin.PluginTool {
  return {
    name: "shell_exec",
    label: "Shell Exec",
    description: "Run a shell command in the configured workspace.",
    parameters: shellExecParameters,
    beforeExecute({ event, requestApproval }) {
      const params = event.input as Partial<ShellExecParameters>;
      const command = typeof params.command === "string" ? params.command : "";
      const risk = classifyShellCommandRisk(command);

      if (risk === "safe") {
        return undefined;
      }

      return requestApproval(`Allowed to execute the command: ${params.command}`);
    },
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as ShellExecParameters;
      const cwd = params.cwd ?? env.cwd;
      const controller = new AbortController();
      const shell = shellProcessManager.register({
        command: params.command,
        controller,
        cwd,
        ...(options.taskId ? { taskId: options.taskId } : {}),
        toolCallId: _toolCallId
      });
      const onAbort = () => {
        shellProcessManager.kill(shell.id);
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      const execPromise = env
        .exec(params.command, {
          abortSignal: controller.signal,
          cwd,
          onStderr: (chunk) => {
            shellProcessManager.appendStderr(shell.id, chunk);
          },
          onStdout: (chunk) => {
            shellProcessManager.appendStdout(shell.id, chunk);
          }
        })
        .then((result) => {
          if (!result.ok) {
            shellProcessManager.fail(shell.id);
            throw result.error;
          }

          shellProcessManager.complete(shell.id, result.value.exitCode);

          return result.value;
        })
        .finally(() => {
          signal?.removeEventListener("abort", onAbort);
        });
      const waitResult = await waitForShellResult(
        execPromise,
        (params.timeoutSeconds ?? DEFAULT_WAIT_TIMEOUT_SECONDS) * 1000
      );
      const record = shellProcessManager.get(shell.id) ?? shell;

      if (waitResult.status === "completed") {
        return {
          content: [
            {
              type: "text",
              text: formatShellOutput(record)
            }
          ],
          details: toShellDetails(record)
        };
      }

      execPromise.catch(() => undefined);

      return {
        content: [
          {
            type: "text",
            text: formatShellOutput(record)
          }
        ],
        details: toShellDetails(record)
      };
    },
    executionMode: "sequential"
  };
}

export function createShellReadTool(): ServerPlugin.PluginTool {
  return {
    name: "shell_read",
    label: "Shell Read",
    description: "Read output and status for a registered shell command.",
    parameters: shellReadParameters,
    async execute(_toolCallId, rawParams) {
      const params = rawParams as ShellReadParameters;
      const record = shellProcessManager.get(params.shellId);

      if (!record) {
        throw new Error(`Unknown shell command: ${params.shellId}`);
      }

      return {
        content: [
          {
            type: "text",
            text: formatShellOutput(record)
          }
        ],
        details: toShellDetails(record)
      };
    },
    executionMode: "sequential"
  };
}

export function createShellKillTool(): ServerPlugin.PluginTool {
  return {
    name: "shell_kill",
    label: "Shell Kill",
    description: "Stop a registered running shell command.",
    parameters: shellKillParameters,
    beforeExecute({ event, requestApproval }) {
      const params = event.input as Partial<ShellKillParameters>;

      return requestApproval(
        `Allowed to stop shell command: ${params.shellId ?? "unknown"}`
      );
    },
    async execute(_toolCallId, rawParams) {
      const params = rawParams as ShellKillParameters;
      const record = shellProcessManager.kill(params.shellId);

      if (!record) {
        throw new Error(`Unknown shell command: ${params.shellId}`);
      }

      return {
        content: [
          {
            type: "text",
            text: formatShellOutput(record)
          }
        ],
        details: toShellDetails(record)
      };
    },
    executionMode: "sequential"
  };
}

async function waitForShellResult<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<{ status: "completed" } | { status: "running" }> {
  return await Promise.race([
    promise.then(() => ({ status: "completed" as const })),
    new Promise<{ status: "running" }>((resolve) => {
      setTimeout(() => {
        resolve({ status: "running" });
      }, timeoutMs);
    })
  ]);
}

function toShellDetails(record: ShellProcessRecord) {
  return {
    command: record.command,
    cwd: record.cwd,
    ...(record.endedAt ? { endedAt: record.endedAt } : {}),
    ...(record.exitCode === undefined ? {} : { exitCode: record.exitCode }),
    shellId: record.id,
    status: record.status,
    stderrLength: record.stderr.length,
    stdoutLength: record.stdout.length,
    ...(record.taskId ? { taskId: record.taskId } : {}),
    truncated: record.truncated
  };
}

function formatShellOutput(input: ShellProcessRecord): string {
  return [
    `shellId: ${input.id}`,
    `status: ${input.status}`,
    `cwd: ${input.cwd}`,
    `command: ${input.command}`,
    ...(input.exitCode === undefined ? [] : [`exitCode: ${input.exitCode}`]),
    "",
    "stdout:",
    truncateOutput(input.stdout),
    "",
    "stderr:",
    truncateOutput(input.stderr)
  ].join("\n");
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }

  return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n[output truncated]`;
}
