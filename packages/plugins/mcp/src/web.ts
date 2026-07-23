import type { WebPlugin } from "@hold-rein/plugin-web";
import { createElement } from "react";

import { PLUGIN_ID } from "./plugin-id";
import { McpSettingsView } from "./web/mcp-settings-view";

const webPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: ({ request }) => ({
    settings: [
      {
        Render: () => createElement(McpSettingsView, { request }),
        id: "settings",
        title: "MCP 配置"
      }
    ]
  })
};

export default webPlugin;
