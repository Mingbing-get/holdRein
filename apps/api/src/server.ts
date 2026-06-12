import { createApp } from "./app";
import { loadApiEnv } from "./config/env";
import { pluginRegistry } from './plugin'

loadApiEnv();

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

async function main() {
  // todo: 注册插件
  pluginRegistry.register({ id: '' })

  const app = await createApp()
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
  });
}

main()
