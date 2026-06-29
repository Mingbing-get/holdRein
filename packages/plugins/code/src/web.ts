import type { WebPlugin } from '@hold-rein/plugin-web'
import {
  deleteFileTool,
  editFileTool,
  findFilesTool,
  grepFilesTool,
  readFileTool,
  writeFileTool,
} from './web/tools'
import { fileChangeSummaryTurnFooter } from './web/turn-footers'
import { PLUGIN_ID } from "./plugin-id";

const baseWebPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: {
    toolRenders: [
      readFileTool,
      writeFileTool,
      deleteFileTool,
      grepFilesTool,
      findFilesTool,
      editFileTool
    ],
    turnFooterRenders: [
      fileChangeSummaryTurnFooter
    ]
  }
}

export default baseWebPlugin
