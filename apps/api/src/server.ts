import baseServerPlugin from '@hold-rein/plugins-base-server'
import tsStandardsServerPlugin from '@hold-rein/plugins-ts-standards-server'

import { createApp } from "./app";
import { loadApiEnv } from "./config/env";
import { getDefaultAgentsService } from "./modules/agents";
import { pluginRegistry } from './plugin'

loadApiEnv();

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

async function main() {
  pluginRegistry.register(baseServerPlugin);
  pluginRegistry.register(tsStandardsServerPlugin);
  getDefaultAgentsService();

  const app = await createApp()
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

main()
