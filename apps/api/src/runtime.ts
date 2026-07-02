import type { Server } from "node:http";

import { createApp } from "./app";
import { getApiEnv, loadApiEnv } from "./config/env";
import { getDefaultAgentsService } from "./modules/agents";
import { getDefaultScheduledTasksService } from "./modules/scheduled-tasks";
import { bootstrapServerPlugins } from "./plugin";

export interface StartHoldReinServerOptions {
  readonly host: string;
  readonly port: number;
  readonly webAssetsDirectory?: string;
  readonly write?: (value: string) => void;
}

export interface StartHoldReinServerResult {
  readonly host: string;
  readonly port: number;
  readonly server: Server;
  readonly url: string;
}

export async function startHoldReinServer(
  options: StartHoldReinServerOptions
): Promise<StartHoldReinServerResult> {
  loadApiEnv();
  const env = getApiEnv();

  await bootstrapServerPlugins(env.pluginRoot);
  const agentsService = getDefaultAgentsService();
  getDefaultScheduledTasksService({ agentsService }).start();

  const app =
    options.webAssetsDirectory === undefined
      ? await createApp()
      : await createApp({ webAssetsDirectory: options.webAssetsDirectory });
  const server = await listen(app, options.port, options.host);
  const url = `http://${options.host}:${options.port}`;

  options.write?.(`API server listening at ${url}\n`);

  return {
    host: options.host,
    port: options.port,
    server,
    url
  };
}

function listen(
  app: Awaited<ReturnType<typeof createApp>>,
  port: number,
  host: string
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      resolve(server);
    });

    server.once("error", reject);
  });
}
