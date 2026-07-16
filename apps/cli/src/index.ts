import {
  createCommand,
  formatCommandHelp,
  type CommandHelpRow
} from "./command-registry";
import { createPluginCommand } from "./commands/plugin";
import { createScheduledTaskCommand } from "./commands/scheduled-task";
import { createStartCommand } from "./commands/start";
import { createUsageCommand } from "./commands/usage";
import { createWorkspaceCommand } from "./commands/workspace";
import { formatError } from "./options";
import type { CliOptions, CliResult } from "./types";

export type {
  CliOptions,
  CliResult,
  CliServices,
  RunServerOptions,
  RunServerResult,
  ScheduledTasksService,
  StartRunServer,
  UsageStatsService,
  WorkspacesService
} from "./types";

const VERSION_ARGS = new Set(["version", "--version", "-v"]);
const HELP_ARGS = new Set(["help", "--help", "-h"]);

const GLOBAL_COMMAND_HELP: readonly CommandHelpRow[] = [
  ["version", "Print the current CLI version"],
  ["help", "Print this help message"]
];

const GLOBAL_OPTION_HELP: readonly CommandHelpRow[] = [
  ["-v, --version", "Print the current CLI version"],
  ["-h, --help", "Print this help message"]
];

export const getHelpText = (): string => buildHelpText(createRootCommand());

export const runCli = async (
  args: readonly string[],
  options: CliOptions
): Promise<CliResult> => {
  const [commandName] = args;
  const rootCommand = createRootCommand();
  const helpText = buildHelpText(rootCommand);

  if (commandName === undefined || HELP_ARGS.has(commandName)) {
    options.write(helpText);
    return { exitCode: 0 };
  }

  if (VERSION_ARGS.has(commandName)) {
    options.write(`${options.packageVersion}\n`);
    return { exitCode: 0 };
  }

  if (!rootCommand.has(commandName)) {
    options.write(`Unknown command: ${commandName}\n\n${helpText}`);
    return { exitCode: 1 };
  }

  try {
    return await rootCommand.run(args, { options });
  } catch (error) {
    options.write(`Failed to run command: ${formatError(error)}\n`);
    return { exitCode: 1 };
  }
};

function createRootCommand() {
  return createCommand("hold-rein")
    .use("start", createStartCommand())
    .use("workspace", createWorkspaceCommand())
    .use("scheduled-task", createScheduledTaskCommand())
    .use("usage", createUsageCommand())
    .use("plugin", createPluginCommand());
}

function buildHelpText(rootCommand: ReturnType<typeof createRootCommand>): string {
  const help = formatCommandHelp(rootCommand);
  const commands = [...help.commands, ...GLOBAL_COMMAND_HELP];
  const options = [...help.options, ...GLOBAL_OPTION_HELP];

  return [
    "Hold Rein CLI",
    "",
    "Usage: hold-rein <command>",
    "",
    "Aliases: hold-rein, hr",
    "",
    "Commands:",
    ...formatHelpRows(commands),
    "",
    "Options:",
    ...formatHelpRows(options),
    ""
  ].join("\n");
}

function formatHelpRows(rows: readonly CommandHelpRow[]): readonly string[] {
  return rows.map(([usage, description]) => `  ${usage}  ${description}`);
}
