import type { WebPlugin } from "@hold-rein/plugin-web";

import { PLUGIN_ID } from "./plugin-id";
import { createRequestSelfApiTool } from "./web/request-self-api-tool";
import { requestSelfApiToolRender } from "./web/request-self-api-tool-render";

const selfManagerWebPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: (context) => ({
    toolRenders: [requestSelfApiToolRender],
    tools: [createRequestSelfApiTool(context.request)]
  })
};

export default selfManagerWebPlugin;
