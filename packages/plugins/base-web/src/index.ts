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
} from './tools'
import { createShellProcesses } from './right-panels'
import { fileChangeSummaryTurnFooter } from './turn-footers'

const baseWebPlugin: WebPlugin.Plugin = {
  id: '__base',
  contributionResolver: ({ request }) => ({
    // settings: [
    //   {
    //     id: 'test',
    //     title: 'test',
    //     Render: () => '11111'
    //   }
    // ],
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
    // senderSuggestions: [
    //   {
    //     trigger: '/',
    //     suggestions: [
    //       {
    //         label: 'from plugin',
    //         value: 'plugin'
    //       }
    //     ]
    //   },
    //   {
    //     trigger: '@',
    //     suggestions: [
    //       {
    //         label: 'from plugin',
    //         value: 'plugin'
    //       }
    //     ]
    //   }
    // ],
    // senderActions: [
    //   {
    //     id: 'test',
    //     Render: () => 'aasd'
    //   }
    // ],
    rightPanels: [
      createShellProcesses({ request })
    ],
    turnFooterRenders: [
      fileChangeSummaryTurnFooter
    ]
  })
}

export default baseWebPlugin
