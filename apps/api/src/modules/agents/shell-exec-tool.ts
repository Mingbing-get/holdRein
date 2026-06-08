import type { ExecutionEnv } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "@earendil-works/pi-ai";

import type { AgentTool } from "@earendil-works/pi-agent-core";

const MAX_OUTPUT_LENGTH = 20_000;

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

export function createShellExecTool(env: ExecutionEnv): AgentTool {
  return {
    name: "shell_exec",
    label: "Shell Exec",
    description: "Run a shell command in the configured workspace.",
    parameters: shellExecParameters,
    async execute(_toolCallId, rawParams, signal) {
      const params = rawParams as ShellExecParameters;
      const cwd = params.cwd ?? env.cwd;
      const execOptions = {
        cwd,
        timeout: params.timeoutSeconds ?? 60,
        ...(signal ? { abortSignal: signal } : {})
      };
      const result = await env.exec(params.command, {
        ...execOptions
      });

      if (!result.ok) {
        throw result.error;
      }

      return {
        content: [
          {
            type: "text",
            text: formatShellOutput({
              command: params.command,
              cwd,
              exitCode: result.value.exitCode,
              stderr: result.value.stderr,
              stdout: result.value.stdout
            })
          }
        ],
        details: {
          command: params.command,
          cwd,
          exitCode: result.value.exitCode,
          stderrLength: result.value.stderr.length,
          stdoutLength: result.value.stdout.length
        }
      };
    },
    executionMode: "sequential"
  };
}

function formatShellOutput(input: {
  command: string;
  cwd: string;
  exitCode: number;
  stderr: string;
  stdout: string;
}): string {
  return [
    `cwd: ${input.cwd}`,
    `command: ${input.command}`,
    `exitCode: ${input.exitCode}`,
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
