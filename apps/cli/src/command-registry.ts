import type { CliOptions, CliResult } from "./types";

export interface CommandContext {
  readonly options: CliOptions;
}

export type CommandHandler = (
  args: readonly string[],
  context: CommandContext
) => Promise<CliResult> | CliResult;

export interface Command {
  has: (name: string) => boolean;
  readonly name: string;
  run: CommandHandler;
  use: (name: string, handler: CommandHandler | Command) => Command;
}

export function createCommand(name: string): Command {
  const children = new Map<string, CommandHandler>();

  const command: Command = {
    has: (childName) => children.has(childName),
    name,
    run: (args, context) => {
      const [subcommand, ...subcommandArgs] = args;
      const child = subcommand === undefined ? undefined : children.get(subcommand);

      if (!child) {
        context.options.write(`Unknown command: ${formatCommand(name, subcommand)}\n`);
        return { exitCode: 1 };
      }

      return child(subcommandArgs, context);
    },
    use: (childName, handler) => {
      children.set(
        childName,
        "run" in handler ? (args, context) => handler.run(args, context) : handler
      );
      return command;
    }
  };

  return command;
}

function formatCommand(name: string, subcommand: string | undefined): string {
  return subcommand === undefined ? name : `${name} ${subcommand}`;
}
