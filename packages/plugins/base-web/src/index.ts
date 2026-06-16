import type { WebPlugin } from '@hold-rein/plugin-web'

const baseWebPlugin: WebPlugin.Plugin = {
  id: '__base',
  contributionResolver: {
    // settings: [
    //   {
    //     id: 'test',
    //     title: 'test',
    //     Render: () => '11111'
    //   }
    // ],
    // toolRenders: [
    //   {
    //     toolName: 'shell_exec',
    //     Render: () => '1212'
    //   }
    // ]
  }
}

export default baseWebPlugin
