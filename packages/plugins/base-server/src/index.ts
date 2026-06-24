import type { ServerPlugin } from '@hold-rein/plugin-server'

import createRouter from './routes'
import {
  createDeleteFileTool,
  createEditFileTool,
  createFindFilesTool,
  createGrepFilesTool,
  createReadFileTool,
  createShellExecTool,
  createShellKillTool,
  createShellReadTool,
  createWriteFileTool
} from './tools'
import { shellProcessManager } from './tools/shell-exec-tool/shell-process-manager'

const baseServerPlugin: ServerPlugin.Plugin = {
  id: '__base',
  registerRoutes: createRouter,
  contributionResolver: (context) => {
    return {
      tools: [
        createReadFileTool(context.env),
        createWriteFileTool(context.env),
        createDeleteFileTool(context.env),
        createGrepFilesTool(context.env),
        createFindFilesTool(context.env),
        createEditFileTool(context.env),
        createShellExecTool(context.env, { taskId: context.taskId }),
        createShellReadTool(),
        createShellKillTool()
      ]
    }
  }
}

export default baseServerPlugin
