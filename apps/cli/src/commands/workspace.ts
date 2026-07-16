import { createCommand, type CommandHandler } from "../command-registry";
import { readOptionValue } from "../options";
import { getDefaultWorkspacesService } from "../service-loaders";

export function createWorkspaceCommand() {
  return createCommand("workspace", { description: "Manage workspaces" })
    .use(
      "list",
      createCommand("list", { description: "List recent workspaces" }).handle(
        listWorkspaces
      )
    )
    .use(
      "delete",
      createCommand("delete", {
        description: "Delete a workspace record",
        usage: "delete <id>"
      }).handle(deleteWorkspace)
    )
    .use(
      "tasks",
      createCommand("tasks", {
        description: "List workspace tasks",
        usage: "tasks <id>"
      }).handle(listWorkspaceTasks)
    )
    .use(
      "setting",
      createCommand("setting", {
        description: "Print workspace settings",
        usage: "setting <id>"
      }).handle(printWorkspaceSetting)
    )
    .use(
      "setting-update",
      createCommand("setting-update", {
        description: "Update workspace settings",
        usage: "setting-update <id>"
      })
        .option(
          "--active-plugins <ids|null>",
          "Replace active plugin ids with a comma-separated list or null"
        )
        .option(
          "--active-skills <ids|null>",
          "Replace active skill ids with a comma-separated list or null"
        )
        .handle(updateWorkspaceSetting)
    );
}

const listWorkspaces: CommandHandler = async (_args, context) => {
  const service =
    context.options.services?.workspaces ?? (await getDefaultWorkspacesService());
  const result = service.listRecentWorkspaceTasks();

  if (result.workspaces.length === 0) {
    context.options.write("No workspaces found\n");
    return { exitCode: 0 };
  }

  for (const workspace of result.workspaces) {
    context.options.write(
      `${workspace.id}\t${workspace.name}\t${workspace.path}\t${workspace.tasks.length} tasks\n`
    );
  }

  return { exitCode: 0 };
};

const deleteWorkspace: CommandHandler = async (args, context) => {
  const workspaceId = readWorkspaceId(args);
  const service =
    context.options.services?.workspaces ?? (await getDefaultWorkspacesService());
  const result = await service.deleteWorkspace(workspaceId);

  if (result.status === "not_found") {
    context.options.write(`Unknown workspace ${workspaceId}\n`);
    return { exitCode: 1 };
  }

  if (result.status === "has_running_tasks") {
    context.options.write(`Workspace ${workspaceId} has running tasks\n`);
    return { exitCode: 1 };
  }

  context.options.write(`Deleted workspace ${workspaceId}\n`);
  return { exitCode: 0 };
};

const listWorkspaceTasks: CommandHandler = async (args, context) => {
  const workspaceId = readWorkspaceId(args);
  const afterLastContinuedAt =
    readOptionValue(args, "--after") ?? new Date(0).toISOString();
  const limit = Number(readOptionValue(args, "--limit") ?? "20");

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("limit must be a positive integer");
  }

  const service =
    context.options.services?.workspaces ?? (await getDefaultWorkspacesService());
  const result = service.listWorkspaceTasksAfter({
    afterLastContinuedAt,
    limit,
    workspaceId
  }) as
    | {
        readonly tasks: readonly {
          readonly id: string;
          readonly status: string;
          readonly title: string;
        }[];
      }
    | undefined;

  if (!result) {
    context.options.write(`Unknown workspace ${workspaceId}\n`);
    return { exitCode: 1 };
  }

  for (const task of result.tasks) {
    context.options.write(`${task.id}\t${task.status}\t${task.title}\n`);
  }

  return { exitCode: 0 };
};

const printWorkspaceSetting: CommandHandler = async (args, context) => {
  const workspaceId = readWorkspaceId(args);
  const service =
    context.options.services?.workspaces ?? (await getDefaultWorkspacesService());
  const setting = await service.getWorkspaceSetting(workspaceId);

  if (!setting) {
    context.options.write(`Unknown workspace ${workspaceId}\n`);
    return { exitCode: 1 };
  }

  context.options.write(`${JSON.stringify(setting, null, 2)}\n`);
  return { exitCode: 0 };
};

const updateWorkspaceSetting: CommandHandler = async (args, context) => {
  const workspaceId = readWorkspaceId(args);
  const service =
    context.options.services?.workspaces ?? (await getDefaultWorkspacesService());
  const result = await service.updateWorkspaceSetting(workspaceId, {
    ...optionalCsv(args, "--active-plugins", "activePlugins"),
    ...optionalCsv(args, "--active-skills", "activeSkills")
  });

  if (!result) {
    context.options.write(`Unknown workspace ${workspaceId}\n`);
    return { exitCode: 1 };
  }

  context.options.write(`${JSON.stringify(result, null, 2)}\n`);
  return { exitCode: 0 };
};

function readWorkspaceId(args: readonly string[]): string {
  const workspaceId = args[0];
  if (workspaceId === undefined || workspaceId.startsWith("-")) {
    throw new Error("Missing workspace id");
  }

  return workspaceId;
}

function optionalCsv(
  args: readonly string[],
  optionName: string,
  key: string
): Record<string, readonly string[] | null> {
  const value = readOptionValue(args, optionName);
  if (value === undefined) return {};
  if (value === "null") return { [key]: null };
  return {
    [key]: value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}
