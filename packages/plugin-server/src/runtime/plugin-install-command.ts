import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PluginInstallCommandResult {
  readonly stderr?: string;
  readonly stdout?: string;
}

export type PluginInstallCommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string
) => Promise<PluginInstallCommandResult> | Promise<void>;

export type PluginInstallWriter = (value: string) => void;

export async function runInstallCommand(
  runner: PluginInstallCommandRunner | undefined,
  command: string,
  args: readonly string[],
  cwd: string,
  write?: PluginInstallWriter
): Promise<void> {
  write?.(`Running: ${formatCommand(command, args)}\n`);

  const result = runner
    ? ((await runner(command, args, cwd)) as PluginInstallCommandResult | undefined)
    : await execFileAsync(command, [...args], { cwd });

  if (result?.stdout) {
    write?.(ensureTrailingNewline(result.stdout));
  }
  if (result?.stderr) {
    write?.(ensureTrailingNewline(result.stderr));
  }
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}
