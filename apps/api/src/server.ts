import { createApp } from "./app";
import { getApiEnv, loadApiEnv } from "./config/env";
import { getDefaultAgentsService } from "./modules/agents";
import { bootstrapServerPlugins } from "./plugin";

loadApiEnv();
const env = getApiEnv();

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

async function main() {
  await bootstrapServerPlugins(env.pluginRoot);
  getDefaultAgentsService();

  const app = await createApp()
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

main()
