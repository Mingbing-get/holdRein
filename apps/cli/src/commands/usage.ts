import { createCommand, type CommandHandler } from "../command-registry";
import { readOptionValue } from "../options";
import { getDefaultUsageStatsService } from "../service-loaders";

export function createUsageCommand() {
  return createCommand("usage", { description: "Print usage statistics" })
    .use(
      "models",
      createCommand("models", { description: "Print model token usage" })
        .option("--range <24h|30d>", "Choose model usage range")
        .handle(printModelUsage)
    )
    .use(
      "tasks",
      createCommand("tasks", { description: "Print task token usage" })
        .option("--range <7d|30d>", "Choose task usage range")
        .option("--group-by <task|workspace>", "Group task usage rows")
        .handle(printTaskUsage)
    );
}

const printModelUsage: CommandHandler = async (args, context) => {
  const service =
    context.options.services?.usageStats ?? (await getDefaultUsageStatsService());
  const range = parseModelRange(readOptionValue(args, "--range") ?? "24h");
  const result = service.getModelTokenUsage({ range });

  for (const point of result.points) {
    context.options.write(
      [
        point.period,
        point.provider,
        point.modelName,
        point.inputToken,
        point.outputToken,
        point.inputToken + point.outputToken
      ].join("\t") + "\n"
    );
  }

  return { exitCode: 0 };
};

const printTaskUsage: CommandHandler = async (args, context) => {
  const service =
    context.options.services?.usageStats ?? (await getDefaultUsageStatsService());
  const range = parseTaskRange(readOptionValue(args, "--range") ?? "7d");
  const groupBy = parseTaskGroupBy(readOptionValue(args, "--group-by") ?? "task");
  const result = service.getTaskTokenUsage({ groupBy, range });

  for (const row of result.rows) {
    context.options.write(
      [
        row.id,
        row.label,
        row.workspaceName,
        row.inputToken,
        row.outputToken,
        row.inputToken + row.outputToken
      ].join("\t") + "\n"
    );
  }

  return { exitCode: 0 };
};

function parseModelRange(value: string): "24h" | "30d" {
  if (value === "24h" || value === "30d") return value;
  throw new Error("range must be 24h or 30d");
}

function parseTaskRange(value: string): "7d" | "30d" {
  if (value === "7d" || value === "30d") return value;
  throw new Error("range must be 7d or 30d");
}

function parseTaskGroupBy(value: string): "task" | "workspace" {
  if (value === "task" || value === "workspace") return value;
  throw new Error("group-by must be task or workspace");
}
