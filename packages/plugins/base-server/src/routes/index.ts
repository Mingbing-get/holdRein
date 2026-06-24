import { Router } from 'express'
import type { Request, Response } from 'express'
import type { ServerPlugin } from '@hold-rein/plugin-server'

import { shellProcessManager } from '../tools/shell-exec-tool/shell-process-manager'

export default function createRouter(context: ServerPlugin.RouteContext): Router {
  const router = Router()

  router.get('/shells', (request: Request, response: Response) => {
    const taskId = typeof request.query.taskId === 'string'
      ? request.query.taskId
      : undefined

    context.sendSuccess(response, shellProcessManager.list(taskId))
  })

  router.get('/shells/:shellId', (
    request: Request<{ shellId: string }>,
    response: Response
  ) => {
    const record = shellProcessManager.get(request.params.shellId)

    if (!record) {
      context.sendError(response, context.RESPONSE_CODE_DEFINITIONS.notFound)
      return
    }

    context.sendSuccess(response, record)
  })

  router.post('/shells/:shellId/kill', (
    request: Request<{ shellId: string }>,
    response: Response
  ) => {
    const record = shellProcessManager.kill(request.params.shellId)

    if (!record) {
      context.sendError(response, context.RESPONSE_CODE_DEFINITIONS.notFound)
      return
    }

    context.sendSuccess(response, record)
  })

  return router
}
