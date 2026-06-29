import type { ServerPlugin } from "@hold-rein/plugin-server";
import createRouter from './server/routes'
import {
  createShellExecTool,
  createShellKillTool,
  createShellReadTool
} from './server/tools'
import { shellProcessManager } from './server/tools/shell-exec-tool/shell-process-manager'

import { PLUGIN_ID } from "./plugin-id";

const MAIN_AGENT_SHELL_CLEANUP_DELAY_MS = 60 * 60 * 1000

const shellCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()

const baseServerPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  registerRoutes: createRouter,
  contributionResolver: (context) => {
    return {
      tools: [
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
};

export default baseServerPlugin;
