import { createCommand } from "./command-registry";
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

const HELP_TEXT = `Hold Rein CLI

Usage: hold-rein <command>

Aliases: hold-rein, hr

Commands:
  start      Start the bundled Hold Rein service
  workspace list    List recent workspaces
  workspace delete <id>    Delete a workspace record
  workspace tasks <id>     List workspace tasks
  workspace setting <id>   Print workspace settings
  workspace setting-update <id>  Update workspace settings
  scheduled-task list    List scheduled tasks
  scheduled-task show <id>      Show a scheduled task
  scheduled-task create         Create a scheduled task
  scheduled-task update <id>    Update a scheduled task
  scheduled-task delete <id>    Delete a scheduled task
  scheduled-task enable <id>    Enable a scheduled task
  scheduled-task disable <id>   Disable a scheduled task
  usage models    Print model token usage
  usage tasks     Print task token usage
  plugin init    Initialize a plugin package
  plugin install Install a plugin package
  version    Print the current CLI version
  help       Print this help message

Options:
  start --host <host>    Bind to a specific host (default: 127.0.0.1)
  start --port <port>    Bind to a specific port (default: 3001)
  start --plugin-dev <path>  Load a local plugin source in development mode
  scheduled-task list --workspace <path>  Filter scheduled tasks by workspace
  scheduled-task create --name <name> --prompt <prompt> --provider <provider>
  scheduled-task create --model <model> --workspace <path> --cron <expr>
  scheduled-task create --timezone <tz> --thinking <level> [--allow-concurrent]
  usage models --range <24h|30d>    Choose model usage range
  usage tasks --range <7d|30d>      Choose task usage range
  usage tasks --group-by <task|workspace>  Group task usage rows
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
  const [commandName] = args;

  if (commandName === undefined || HELP_ARGS.has(commandName)) {
    options.write(HELP_TEXT);
    return { exitCode: 0 };
  }

  if (VERSION_ARGS.has(commandName)) {
    options.write(`${options.packageVersion}\n`);
    return { exitCode: 0 };
  }

  const rootCommand = createRootCommand();

  if (!rootCommand.has(commandName)) {
    options.write(`Unknown command: ${commandName}\n\n${HELP_TEXT}`);
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
