import { createCommand } from "../command-registry";
import { readOptionValue } from "../options";
import { getDefaultWorkspacesService } from "../service-loaders";

export function createWorkspaceCommand() {
  return createCommand("workspace")
    .use("list", async (_args, context) => {
      const service =
        context.options.services?.workspaces ??
        (await getDefaultWorkspacesService());
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
    })
    .use("delete", async (args, context) => {
      const workspaceId = readWorkspaceId(args);
      const service =
        context.options.services?.workspaces ??
        (await getDefaultWorkspacesService());
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
    })
    .use("tasks", async (args, context) => {
      const workspaceId = readWorkspaceId(args);
      const afterLastContinuedAt =
        readOptionValue(args, "--after") ?? new Date(0).toISOString();
      const limit = Number(readOptionValue(args, "--limit") ?? "20");

      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("limit must be a positive integer");
      }

      const service =
        context.options.services?.workspaces ??
        (await getDefaultWorkspacesService());
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
    })
    .use("setting", async (args, context) => {
      const workspaceId = readWorkspaceId(args);
      const service =
        context.options.services?.workspaces ??
        (await getDefaultWorkspacesService());
      const setting = await service.getWorkspaceSetting(workspaceId);

      if (!setting) {
        context.options.write(`Unknown workspace ${workspaceId}\n`);
        return { exitCode: 1 };
      }

      context.options.write(`${JSON.stringify(setting, null, 2)}\n`);
      return { exitCode: 0 };
    })
    .use("setting-update", async (args, context) => {
      const workspaceId = readWorkspaceId(args);
      const service =
        context.options.services?.workspaces ??
        (await getDefaultWorkspacesService());
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
    });
}

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
