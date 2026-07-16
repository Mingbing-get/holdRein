import { fileURLToPath } from "node:url";

import { createCommand } from "../command-registry";
import { formatError, readOptionValue, readRepeatedOptionValues } from "../options";
import type { RunServerOptions, RunServerResult } from "../types";

const DEFAULT_RUN_HOST = "127.0.0.1";
const DEFAULT_RUN_PORT = 3001;

export function createStartCommand() {
  const command = createCommand("start", {
    description: "Start the bundled Hold Rein service"
  })
    .option("--host <host>", "Bind to a specific host (default: 127.0.0.1)")
    .option("--port <port>", "Bind to a specific port (default: 3001)")
    .option(
      "--plugin-dev <path>",
      "Load a local plugin source in development mode"
    );

  command.run = async (args, context) => {
    try {
      const runOptions = parseRunOptions(args);
      const startRunServer =
        context.options.startRunServer ?? startBundledRunServer;
      const result = await startRunServer({
        ...(runOptions.devPluginPaths === undefined
          ? {}
          : { devPluginPaths: runOptions.devPluginPaths }),
        host: runOptions.host,
        port: runOptions.port,
        write: context.options.write
      });
      context.options.write(`Hold Rein is running at ${result.url}\n`);
      return { exitCode: 0 };
    } catch (error) {
      context.options.write(`Failed to start service: ${formatError(error)}\n`);
      return { exitCode: 1 };
    }
  };

  return command;
}

function parseRunOptions(args: readonly string[]): {
  readonly devPluginPaths?: readonly string[];
  readonly host: string;
  readonly port: number;
} {
  const devPluginPaths = readRepeatedOptionValues(args, "--plugin-dev");
  const host = readOptionValue(args, "--host") ?? DEFAULT_RUN_HOST;
  const portValue = readOptionValue(args, "--port");
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
