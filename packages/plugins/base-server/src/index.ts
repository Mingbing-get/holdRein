import type { ServerPlugin } from '@hold-rein/plugin-server'

import createRouter from './routes'
import {
  createEditFileTool,
  createFindFilesTool,
  createGrepFilesTool,
  createReadFileTool,
  createShellExecTool,
  createWriteFileTool
} from './tools'

const baseServerPlugin: ServerPlugin.Plugin = {
  id: '__base',
  registerRoutes: createRouter,
  contributionResolver: (context) => {
    return {
      tools: [
        createReadFileTool(context.env),
        createWriteFileTool(context.env),
        createGrepFilesTool(context.env),
        createFindFilesTool(context.env),
        createEditFileTool(context.env),
        createShellExecTool(context.env)
      ],
      // onAgentEnd: () => {
      //   if (context.isContinue || context.agentName !== 'main') {
      //     return
      //   }

      //   return { prompt: '测试自动运行', useSubagent: true }
      // }
    }
  }
}

export default baseServerPlugin
