import { Router } from 'express'
import type { Request, Response } from 'express'
import type { ServerPlugin } from '@hold-rein/plugin-server'

import {
  shellProcessManager,
  type ShellProcessEvent,
  type ShellProcessRecord
} from '../tools/shell-exec-tool/shell-process-manager'

export default function createRouter(context: ServerPlugin.RouteContext): Router {
  const router = Router()

  router.get('/shells', (request: Request, response: Response) => {
    const taskId = typeof request.query.taskId === 'string'
      ? request.query.taskId
      : undefined

    response.status(200)
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    response.flushHeaders()

    for (const event of createShellSnapshotEvents(shellProcessManager.list(taskId))) {
      writeJsonLine(response, event)
    }

    const unsubscribe = shellProcessManager.subscribe((event) => {
      if (taskId !== undefined && event.record.taskId !== taskId) {
        return
      }

      writeJsonLine(response, event)
    })

    request.on('close', () => {
      unsubscribe()
    })
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

function createShellSnapshotEvents(
  records: readonly ShellProcessRecord[]
): ShellProcessEvent[] {
  return records.flatMap((record) => [
    {
      record,
      type: 'shell_start' as const
    },
    ...(record.stdout
      ? [{
        chunk: record.stdout,
        record,
        type: 'shell_stdout' as const
      }]
      : []),
    ...(record.stderr
      ? [{
        chunk: record.stderr,
        record,
        type: 'shell_stderr' as const
      }]
      : []),
    ...(record.status === 'running'
      ? []
      : [{
        record,
        type: 'shell_end' as const
      }])
  ])
}

function writeJsonLine(response: Response, event: ShellProcessEvent): void {
  response.write(`${JSON.stringify(event)}\n`)
}
