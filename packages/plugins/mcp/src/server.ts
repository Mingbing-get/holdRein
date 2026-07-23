import type { ServerPlugin } from "@hold-rein/plugin-server";

import { PLUGIN_ID } from "./plugin-id";
import createRouter from "./server/routes";
import { McpServerConfigService } from "./server/service";
import {
  createMcpPluginTools,
  createMcpReadResourceTool,
  createMcpResourceListTool
} from "./server/tools";

const serverPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  registerRoutes: createRouter,
  contributionResolver: async () => {
    const servers = new McpServerConfigService().listEnabledServerConfigs();
    const options = { servers };

    return {
      tools: [
        ...(await createMcpPluginTools(options)),
        createMcpResourceListTool(options),
        createMcpReadResourceTool(options)
      ]
    };
  }
};

export default serverPlugin;
