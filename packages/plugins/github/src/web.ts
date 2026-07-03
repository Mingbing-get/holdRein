import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "./plugin-id";
import { createGitPanel } from "./web/git-panel";

const webPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: ({ request }) => ({
    rightPanels: [createGitPanel({ request })]
  })
};

export default webPlugin;
