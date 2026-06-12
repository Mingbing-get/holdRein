import { Router } from 'express'

import type { ServerPlugin } from '@hold-rein/plugin-server'

export default function createRouter(context: ServerPlugin.RouteContext): Router {
  const router = Router()

  router.get('/test', (request, response) => {
    context.sendSuccess(response, 'plugin ok')
  })

  return router
}
