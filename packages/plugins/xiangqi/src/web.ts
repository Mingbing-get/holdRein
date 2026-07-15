import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "./plugin-id";
import { createXiangqiContribution } from "./web/contribution";

const webPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: createXiangqiContribution
};

export default webPlugin;
