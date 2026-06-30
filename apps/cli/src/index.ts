export interface CliOptions {
  readonly packageVersion: string;
  readonly write: (value: string) => void;
}

export interface CliResult {
  readonly exitCode: number;
}

const HELP_TEXT = `Hold Rein CLI

Usage: hold-rein <command>

Aliases: hold-rein, hr

Commands:
  version    Print the current CLI version
  help       Print this help message

Options:
  -v, --version    Print the current CLI version
  -h, --help       Print this help message
`;

const VERSION_ARGS = new Set(["version", "--version", "-v"]);
const HELP_ARGS = new Set(["help", "--help", "-h"]);

export const getHelpText = (): string => HELP_TEXT;

export const runCli = (args: readonly string[], options: CliOptions): CliResult => {
  const [command] = args;

  if (command === undefined || HELP_ARGS.has(command)) {
    options.write(HELP_TEXT);
    return { exitCode: 0 };
  }

  if (VERSION_ARGS.has(command)) {
    options.write(`${options.packageVersion}\n`);
    return { exitCode: 0 };
  }

  options.write(`Unknown command: ${command}\n\n${HELP_TEXT}`);
  return { exitCode: 1 };
};
