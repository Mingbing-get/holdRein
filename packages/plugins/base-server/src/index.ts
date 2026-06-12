import type { ServerPlugin } from '@hold-rein/plugin-server'

import createRouter from './routes'

const baseServerPlugin: ServerPlugin.Plugin = {
  id: '__base',
  registerRoutes: createRouter,
  contributionResolver: {
    tools: []
  }
}

export default baseServerPlugin
