import type { WebPlugin } from '@hold-rein/plugin-web'
import {
  deleteFileTool,
  editFileTool,
  findFilesTool,
  grepFilesTool,
  readFileTool,
  shellExecTool,
  writeFileTool,
  callSubagentTool,
  revokeSubagentTool
} from './web/tools'
import { createShellProcesses } from './web/right-panels'
import { fileChangeSummaryTurnFooter } from './web/turn-footers'
import { BASE_EXAMPLE_PLUGIN_ID } from "./plugin-id";

const baseWebPlugin: WebPlugin.Plugin = {
  id: BASE_EXAMPLE_PLUGIN_ID,
  contributionResolver: ({ request }) => ({
    toolRenders: [
      readFileTool,
      writeFileTool,
      deleteFileTool,
      grepFilesTool,
      findFilesTool,
      editFileTool,
      shellExecTool,
      callSubagentTool,
      revokeSubagentTool
    ],
    rightPanels: [
      createShellProcesses({ request })
    ],
    turnFooterRenders: [
      fileChangeSummaryTurnFooter
    ]
  })
}

export default baseWebPlugin
