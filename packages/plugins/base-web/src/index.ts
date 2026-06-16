import type { WebPlugin } from '@hold-rein/plugin-web'

const baseWebPlugin: WebPlugin.Plugin = {
  id: '__base',
  contributionResolver: {
    settings: [
      {
        id: 'test',
        title: 'test',
        Render: () => '11111'
      }
    ]
  }
}

export default baseWebPlugin
