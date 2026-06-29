import type { WebPlugin } from "@hold-rein/plugin-web";

import { BASE_EXAMPLE_PLUGIN_ID } from "./plugin-id";

const baseExampleWebPlugin: WebPlugin.Plugin = {
  id: BASE_EXAMPLE_PLUGIN_ID,
  contributionResolver: () => ({
    rightPanels: [],
    senderActions: [],
    senderSuggestions: [],
    settings: [],
    toolRenders: [],
    tools: [],
    turnFooterRenders: []
  })
};

export default baseExampleWebPlugin;
