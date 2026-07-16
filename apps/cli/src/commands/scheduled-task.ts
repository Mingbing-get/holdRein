import { createCommand } from "../command-registry";
import { readOptionValue } from "../options";
import { getDefaultScheduledTasksService } from "../service-loaders";
import type {
  ScheduledAgentTaskInput,
  ScheduledTasksService,
  ScheduledTaskRow
} from "../types";

export function createScheduledTaskCommand() {
  return createCommand("scheduled-task")
    .use("list", async (args, context) => {
      const service = await getService(context.options.services?.scheduledTasks);
      const workspacePath = readOptionValue(args, "--workspace");
      const tasks = service.listScheduledTasks(
        workspacePath === undefined ? undefined : { workspacePath }
      );

      if (tasks.length === 0) {
        context.options.write("No scheduled tasks found\n");
        return { exitCode: 0 };
      }

      for (const task of tasks) writeTask(context.options.write, task);
      return { exitCode: 0 };
    })
    .use("show", async (args, context) => {
      const id = readId(args);
      const task = (await getService(context.options.services?.scheduledTasks))
        .findScheduledTask(id);

      if (!task) return notFound(context.options.write, id);
      writeTask(context.options.write, task);
      return { exitCode: 0 };
    })
    .use("create", async (args, context) => {
      const task = (await getService(context.options.services?.scheduledTasks))
        .createScheduledTask(parseCreateInput(args));

      writeTask(context.options.write, task);
      return { exitCode: 0 };
    })
    .use("update", async (args, context) => {
      const id = readId(args);
      const task = (await getService(context.options.services?.scheduledTasks))
        .updateScheduledTask(id, parseUpdateInput(args.slice(1)));

      if (!task) return notFound(context.options.write, id);
      writeTask(context.options.write, task);
      return { exitCode: 0 };
    })
    .use("delete", async (args, context) => {
      const id = readId(args);
      const deleted = (await getService(context.options.services?.scheduledTasks))
        .deleteScheduledTask(id);

      if (!deleted) return notFound(context.options.write, id);
      context.options.write(`Deleted scheduled task ${id}\n`);
      return { exitCode: 0 };
    })
    .use("enable", async (args, context) =>
      setEnabled(args, context.options.services?.scheduledTasks, true, context.options.write)
    )
    .use("disable", async (args, context) =>
      setEnabled(args, context.options.services?.scheduledTasks, false, context.options.write)
    );
}

async function getService(
  service: ScheduledTasksService | undefined
): Promise<ScheduledTasksService> {
  return service ?? getDefaultScheduledTasksService();
}

function parseCreateInput(args: readonly string[]): ScheduledAgentTaskInput {
  const enabled = readEnabled(args);

  return {
    allowConcurrentRuns: args.includes("--allow-concurrent"),
    cronExpression: readRequiredOption(args, "--cron"),
    ...(enabled === undefined ? {} : { enabled }),
    modelId: readOptionValue(args, "--model") ?? readRequiredOption(args, "--model-id"),
    name: readRequiredOption(args, "--name"),
    prompt: readRequiredOption(args, "--prompt"),
    provider: readRequiredOption(args, "--provider"),
    thinkingLevel: readRequiredOption(args, "--thinking"),
    timezone: readRequiredOption(args, "--timezone"),
    workspacePath: readRequiredOption(args, "--workspace")
  };
}

function parseUpdateInput(args: readonly string[]): Partial<ScheduledAgentTaskInput> {
  const enabled = readEnabled(args);

  return {
    ...(args.includes("--allow-concurrent") ? { allowConcurrentRuns: true } : {}),
    ...(args.includes("--no-allow-concurrent")
      ? { allowConcurrentRuns: false }
      : {}),
    ...optionalString(args, "--cron", "cronExpression"),
    ...optionalString(args, "--model", "modelId"),
    ...optionalString(args, "--model-id", "modelId"),
    ...optionalString(args, "--name", "name"),
    ...optionalString(args, "--prompt", "prompt"),
    ...optionalString(args, "--provider", "provider"),
    ...optionalString(args, "--thinking", "thinkingLevel"),
    ...optionalString(args, "--timezone", "timezone"),
    ...optionalString(args, "--workspace", "workspacePath"),
    ...(enabled === undefined ? {} : { enabled })
  };
}

function optionalString<K extends keyof ScheduledAgentTaskInput>(
  args: readonly string[],
  optionName: string,
  key: K
): Partial<ScheduledAgentTaskInput> {
  const value = readOptionValue(args, optionName);
  return value === undefined ? {} : { [key]: value };
}

function readEnabled(args: readonly string[]): boolean | undefined {
  const value = readOptionValue(args, "--enabled");
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("enabled must be true or false");
}

function readId(args: readonly string[]): string {
  const id = args[0];
  if (id === undefined || id.startsWith("-")) throw new Error("Missing id");
  return id;
}

function readRequiredOption(args: readonly string[], optionName: string): string {
  const value = readOptionValue(args, optionName);
  if (value === undefined) throw new Error(`Missing value for ${optionName}`);
  return value;
}

async function setEnabled(
  args: readonly string[],
  service: ScheduledTasksService | undefined,
  enabled: boolean,
  write: (value: string) => void
) {
  const id = readId(args);
  const task = enabled
    ? (await getService(service)).enableScheduledTask(id)
    : (await getService(service)).disableScheduledTask(id);

  if (!task) return notFound(write, id);
  writeTask(write, task);
  return { exitCode: 0 };
}

function notFound(write: (value: string) => void, id: string) {
  write(`Unknown scheduled task ${id}\n`);
  return { exitCode: 1 };
}

function writeTask(write: (value: string) => void, task: ScheduledTaskRow): void {
  write(
    [
      task.id,
      task.enabled ? "enabled" : "disabled",
      task.name,
      task.cronExpression,
      task.nextRunAt ?? "none",
      task.workspacePath
    ].join("\t") + "\n"
  );
}
