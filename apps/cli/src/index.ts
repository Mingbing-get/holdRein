import {
  initPluginPackage,
  installPluginPackage as installPluginPackageDefault,
  type InstallPluginPackageOptions
} from "@hold-rein/plugin-server";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export interface CliOptions {
  readonly installPluginPackage?: (
    options: InstallPluginPackageOptions
  ) => Promise<string>;
  readonly packageVersion: string;
  readonly startRunServer?: StartRunServer;
  readonly write: (value: string) => void;
  readonly currentWorkingDirectory?: string;
}

export interface CliResult {
  readonly exitCode: number;
}

export interface RunServerOptions {
  readonly devPluginPaths?: readonly string[];
  readonly host: string;
  readonly port: number;
  readonly write: (value: string) => void;
}

export interface RunServerResult {
  readonly host: string;
  readonly port: number;
  readonly url: string;
}

export type StartRunServer = (
  options: RunServerOptions
) => Promise<RunServerResult>;

const HELP_TEXT = `Hold Rein CLI

Usage: hold-rein <command>

Aliases: hold-rein, hr

Commands:
  start      Start the bundled Hold Rein service
  plugin init    Initialize a plugin package
  plugin install Install a plugin package
  version    Print the current CLI version
  help       Print this help message

Options:
  start --host <host>    Bind to a specific host (default: 127.0.0.1)
  start --port <port>    Bind to a specific port (default: 3001)
  start --plugin-dev <path>  Load a local plugin source in development mode
  plugin init --path <path>    Initialize in a specific path
  plugin init --name <name>    Initialize in a child directory
  plugin install --target <path>    Install into a specific plugin directory
  -v, --version    Print the current CLI version
  -h, --help       Print this help message
`;

const VERSION_ARGS = new Set(["version", "--version", "-v"]);
const HELP_ARGS = new Set(["help", "--help", "-h"]);
const DEFAULT_RUN_HOST = "127.0.0.1";
const DEFAULT_RUN_PORT = 3001;

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

  if (command === "start") {
    try {
      const runOptions = parseRunOptions([subcommand, ...commandArgs]);
      const startRunServer = options.startRunServer ?? startBundledRunServer;
      const result = await startRunServer({
        ...(runOptions.devPluginPaths === undefined
          ? {}
          : { devPluginPaths: runOptions.devPluginPaths }),
        host: runOptions.host,
        port: runOptions.port,
        write: options.write
      });
      options.write(`Hold Rein is running at ${result.url}\n`);
      return { exitCode: 0 };
    } catch (error) {
      options.write(`Failed to start service: ${formatError(error)}\n`);
      return { exitCode: 1 };
    }
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

function parseRunOptions(
  args: readonly (string | undefined)[]
): {
  readonly devPluginPaths?: readonly string[];
  readonly host: string;
  readonly port: number;
} {
  const compactArgs = args.filter((arg): arg is string => arg !== undefined);
  const devPluginPaths = readRepeatedOptionValues(compactArgs, "--plugin-dev");
  const host = readOptionValue(compactArgs, "--host") ?? DEFAULT_RUN_HOST;
  const portValue = readOptionValue(compactArgs, "--port");
  const port = portValue === undefined ? DEFAULT_RUN_PORT : Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer between 1 and 65535");
  }

  return {
    ...(devPluginPaths.length > 0 ? { devPluginPaths } : {}),
    host,
    port
  };
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

async function startBundledRunServer(
  options: RunServerOptions
): Promise<RunServerResult> {
  const runtimeModule = (await import(
    new URL("./runtime/api/runtime.js", import.meta.url).href
  )) as {
    readonly startHoldReinServer: (
      options: RunServerOptions & { readonly webAssetsDirectory: string }
    ) => Promise<RunServerResult>;
  };

  return runtimeModule.startHoldReinServer({
    ...options,
    webAssetsDirectory: fileURLToPath(new URL("./runtime/web", import.meta.url))
  });
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

function readRepeatedOptionValues(
  args: readonly string[],
  optionName: string
): readonly string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("-")) {
      throw new Error(`Missing value for ${optionName}`);
    }

    values.push(value);
  }

  return values;
}
