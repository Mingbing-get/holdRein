import { Router } from 'express'

export default function createRouter(): Router {
  const router = Router()

  // router.get('/test', (request, response) => {
  //   context.sendSuccess(response, 'plugin ok')
  // })

  return router
}
