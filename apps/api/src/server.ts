import { createApp } from "./app";
import { loadApiEnv } from "./config/env";

loadApiEnv();

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);

createApp().listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
