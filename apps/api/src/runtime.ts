import type { Server } from "node:http";

import { createApp } from "./app";
import { getApiEnv, loadApiEnv } from "./config/env";
import { getDefaultAgentsService } from "./modules/agents";
import { getDefaultScheduledTasksService } from "./modules/scheduled-tasks";
import { bootstrapServerPlugins } from "./plugin";
import { TEMP_SKILL_DIR } from "./config/const";
import { cleanupStaleMaterializedSkills } from "./modules/agents/runtime/materialized-skills";

const STALE_TEMP_SKILL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

  await cleanupStaleMaterializedSkills({
    maxAgeMs: STALE_TEMP_SKILL_MAX_AGE_MS,
    rootDir: TEMP_SKILL_DIR
  });
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
