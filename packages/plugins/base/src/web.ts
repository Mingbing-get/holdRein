import type { WebPlugin } from '@hold-rein/plugin-web'
import {
  shellExecTool,
  shellKillTool,
  shellReadTool,
  callSubagentTool,
  revokeSubagentTool
} from './web/tools'
import { createShellProcesses } from './web/right-panels'
import { PLUGIN_ID } from "./plugin-id";

const baseWebPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: ({ request }) => ({
    toolRenders: [
      shellExecTool,
      shellReadTool,
      shellKillTool,
      callSubagentTool,
      revokeSubagentTool
    ],
    rightPanels: [
      createShellProcesses({ request })
    ]
  })
}

export default baseWebPlugin
