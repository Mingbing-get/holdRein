import type { CliOptions, CliResult } from "./types";

export interface CommandContext {
  readonly options: CliOptions;
}

export type CommandHandler = (
  args: readonly string[],
  context: CommandContext
) => Promise<CliResult> | CliResult;

export interface CommandHelp {
  readonly description?: string;
  readonly usage?: string;
}

export type CommandHelpRow = readonly [usage: string, description: string];

export interface CommandHelpText {
  readonly commands: readonly CommandHelpRow[];
  readonly options: readonly CommandHelpRow[];
}

export interface Command {
  readonly children: ReadonlyMap<string, Command>;
  handle: (handler: CommandHandler) => Command;
  has: (name: string) => boolean;
  readonly help: CommandHelp;
  readonly name: string;
  option: (usage: string, description: string) => Command;
  readonly options: readonly CommandHelpRow[];
  run: CommandHandler;
  use: (name: string, handler: CommandHandler | Command) => Command;
}

export function createCommand(name: string, help: CommandHelp = {}): Command {
  const children = new Map<string, Command>();
  const options: CommandHelpRow[] = [];

  const command: Command = {
    children,
    handle: (handler) => {
      command.run = handler;
      return command;
    },
    has: (childName) => children.has(childName),
    help,
    name,
    option: (usage, description) => {
      options.push([usage, description]);
      return command;
    },
    options,
    run: (args, context) => {
      const [subcommand, ...subcommandArgs] = args;
      const child = subcommand === undefined ? undefined : children.get(subcommand);

      if (!child) {
        context.options.write(`Unknown command: ${formatCommand(name, subcommand)}\n`);
        return { exitCode: 1 };
      }

      return child.run(subcommandArgs, context);
    },
    use: (childName, handler) => {
      const child = "run" in handler ? handler : createCommand(childName);
      if (!("run" in handler)) {
        child.handle(handler);
      }
      children.set(childName, child);
      return command;
    }
  };

  return command;
}

export function formatCommandHelp(command: Command): CommandHelpText {
  const commands: CommandHelpRow[] = [];
  const options: CommandHelpRow[] = [];

  for (const child of command.children.values()) {
    collectCommandHelp(child, [], commands, options);
  }

  return { commands, options };
}

function formatCommand(name: string, subcommand: string | undefined): string {
  return subcommand === undefined ? name : `${name} ${subcommand}`;
}

function collectCommandHelp(
  command: Command,
  parents: readonly string[],
  commands: CommandHelpRow[],
  optionRows: CommandHelpRow[]
): void {
  const usage = command.help.usage ?? command.name;
  const path = [...parents, usage];

  if (command.help.description !== undefined) {
    commands.push([path.join(" "), command.help.description]);
  }

  for (const [optionUsage, description] of command.options) {
    optionRows.push([[...path, optionUsage].join(" "), description]);
  }

  for (const child of command.children.values()) {
    collectCommandHelp(child, path, commands, optionRows);
  }
}
