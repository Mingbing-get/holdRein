import type { ServerPlugin } from "@hold-rein/plugin-server";

import { BASE_EXAMPLE_PLUGIN_ID } from "./plugin-id";

const baseExampleServerPlugin: ServerPlugin.Plugin = {
  id: BASE_EXAMPLE_PLUGIN_ID,
  contributionResolver: {
    skills: [],
    systemPrompts: [],
    tools: []
  }
};

export default baseExampleServerPlugin;
