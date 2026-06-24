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

const MAIN_AGENT_SHELL_CLEANUP_DELAY_MS = 60 * 60 * 1000

const shellCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
      ],
      onAgentEnd: () => {
        if (context.agentName !== 'main') {
          return undefined
        }

        const existingTimer = shellCleanupTimers.get(context.taskId)

        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(() => {
          shellCleanupTimers.delete(context.taskId)
          shellProcessManager.killAndRemoveByTask(context.taskId)
        }, MAIN_AGENT_SHELL_CLEANUP_DELAY_MS)

        shellCleanupTimers.set(context.taskId, timer)
        ;(timer as { unref?: () => void }).unref?.()

        return undefined
      }
    }
  }
}

export default baseServerPlugin
