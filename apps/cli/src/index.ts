import {
  initPluginPackage,
  installPluginPackage as installPluginPackageDefault,
  type InstallPluginPackageOptions
} from "@hold-rein/plugin-server";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliOptions {
  readonly installPluginPackage?: (
    options: InstallPluginPackageOptions
  ) => Promise<string>;
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
  plugin init    Initialize a plugin package
  plugin install Install a plugin package
  version    Print the current CLI version
  help       Print this help message

Options:
  plugin init --path <path>    Initialize in a specific path
  plugin init --name <name>    Initialize in a child directory
  plugin install --target <path>    Install into a specific plugin directory
  -v, --version    Print the current CLI version
  -h, --help       Print this help message
`;

const VERSION_ARGS = new Set(["version", "--version", "-v"]);
const HELP_ARGS = new Set(["help", "--help", "-h"]);

export const getHelpText = (): string => HELP_TEXT;

export const runCli = async (
  args: readonly string[],
  options: CliOptions
): Promise<CliResult> => {
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

  if (command === "plugin" && subcommand === "install") {
    try {
      const installOptions = parsePluginInstallOptions(commandArgs);
      const installPluginPackage =
        options.installPluginPackage ?? installPluginPackageDefault;
      const destination = await installPluginPackage({
        currentWorkingDirectory: options.currentWorkingDirectory ?? process.cwd(),
        pluginRoot:
          installOptions.target ?? join(homedir(), ".hold-rein", "plugins"),
        source: installOptions.source,
        write: options.write
      });
      options.write(`Installed plugin to ${destination}\n`);
      return { exitCode: 0 };
    } catch (error) {
      options.write(`Failed to install plugin: ${formatError(error)}\n`);
      return { exitCode: 1 };
    }
  }

  options.write(`Unknown command: ${command}\n\n${HELP_TEXT}`);
  return { exitCode: 1 };
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parsePluginInstallOptions(
  args: readonly string[]
): { readonly source: string; readonly target?: string } {
  const source = args[0];

  if (source === undefined || source.startsWith("-")) {
    throw new Error("Missing plugin source");
  }

  const options: { source: string; target?: string } = { source };
  const target = readOptionValue(args, "--target");

  if (target !== undefined) {
    options.target = target;
  }

  return options;
}

function parsePluginInitOptions(
  args: readonly string[]
): { readonly name?: string; readonly path?: string } {
  const options: { name?: string; path?: string } = {};
  const name = readOptionValue(args, "--name");
  const path = readOptionValue(args, "--path");

  if (name !== undefined) {
    options.name = name;
  }

  if (path !== undefined) {
    options.path = path;
  }

  return options;
}

function readOptionValue(
  args: readonly string[],
  optionName: string
): string | undefined {
  const optionIndex = args.indexOf(optionName);

  if (optionIndex === -1) {
    return undefined;
  }

  const value = args[optionIndex + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}
