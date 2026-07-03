import type { ServerPlugin } from "@hold-rein/plugin-server";

import { PLUGIN_ID } from "./plugin-id";
import createRouter from "./server/routes";

const serverPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  registerRoutes: createRouter
};

export default serverPlugin;
