import { initPluginPackage } from "./plugins/init";

export interface CliOptions {
  readonly packageVersion: string;
  readonly write: (value: string) => void;
  readonly currentWorkingDirectory?: string;
}

export interface CliResult {
  readonly exitCode: number;
}

const HELP_TEXT = `Hold Rein CLI

Usage: hold-rein <command>

Aliases: hold-rein, hr

Commands:
  plugin init    Initialize a plugin package in the current directory
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
  const [command, subcommand, ...commandArgs] = args;

  if (command === undefined || HELP_ARGS.has(command)) {
    options.write(HELP_TEXT);
    return { exitCode: 0 };
  }

  if (VERSION_ARGS.has(command)) {
    options.write(`${options.packageVersion}\n`);
    return { exitCode: 0 };
  }

  if (command === "plugin" && subcommand === "init") {
    try {
      const result = initPluginPackage(
        options.currentWorkingDirectory ?? process.cwd(),
        parsePluginInitOptions(commandArgs)
      );
      options.write(`Initialized plugin package ${result.packageName}\n`);
      return { exitCode: 0 };
    } catch (error) {
      options.write(
        `Failed to initialize plugin package: ${formatError(error)}\n`
      );
      return { exitCode: 1 };
    }
  }

  options.write(`Unknown command: ${command}\n\n${HELP_TEXT}`);
  return { exitCode: 1 };
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePluginInitOptions(
  args: readonly string[]
): { readonly name?: string } {
  const nameIndex = args.indexOf("--name");

  if (nameIndex === -1) {
    return {};
  }

  const name = args[nameIndex + 1];

  if (name === undefined || name.startsWith("-")) {
    throw new Error("Missing value for --name");
  }

  return { name };
}
