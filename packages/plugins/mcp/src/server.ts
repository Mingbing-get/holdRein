import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ServerPlugin } from "@hold-rein/plugin-server";

import { PLUGIN_ID } from "./plugin-id";
import createRouter from "./server/routes";
import { McpServerConfigService } from "./server/service";
import {
  createMcpPluginTools,
  createMcpReadResourceTool,
  createMcpResourceListTool
} from "./server/tools";

const MCP_CONFIGURATION_SKILL_DIR = join(
  skillRootDir(),
  "mcp-configuration"
);

const serverPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  registerRoutes: createRouter,
  contributionResolver: async () => {
    const servers = new McpServerConfigService().listEnabledServerConfigs();
    const options = { servers };

    return {
      skillDirs: [MCP_CONFIGURATION_SKILL_DIR],
      tools: [
        ...(await createMcpPluginTools(options)),
        createMcpResourceListTool(options),
        createMcpReadResourceTool(options)
      ]
    };
  }
};

export default serverPlugin;

function skillRootDir(): string {
  const baseDir = dirname(fileURLToPath(import.meta.url));
  const sourceSkillRoot = join(baseDir, "server/skills");

  return existsSync(sourceSkillRoot)
    ? sourceSkillRoot
    : join(baseDir, "skills");
}
