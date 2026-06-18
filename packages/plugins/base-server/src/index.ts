import type { ServerPlugin } from '@hold-rein/plugin-server'

import createRouter from './routes'
import { createShellExecTool } from './tools'

const baseServerPlugin: ServerPlugin.Plugin = {
  id: '__base',
  registerRoutes: createRouter,
  contributionResolver: (context) => {
    return {
      tools: [createShellExecTool(context.env)],
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
