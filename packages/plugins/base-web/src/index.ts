import type { WebPlugin } from '@hold-rein/plugin-web'
import { shellExecTool } from './tools'

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
    toolRenders: [
      shellExecTool
    ],
    // senderSuggestions: [
    //   {
    //     trigger: '/',
    //     suggestions: [
    //       {
    //         label: 'from plugin',
    //         value: 'plugin'
    //       }
    //     ]
    //   },
    //   {
    //     trigger: '@',
    //     suggestions: [
    //       {
    //         label: 'from plugin',
    //         value: 'plugin'
    //       }
    //     ]
    //   }
    // ],
    // senderActions: [
    //   {
    //     id: 'test',
    //     Render: () => 'aasd'
    //   }
    // ],
    // rightPanels: [
    //   {
    //     id: 'test',
    //     icon: 'aa',
    //     title: 'test aa',
    //     Render: () => 'content'
    //   },
    //   {
    //     id: 'test1',
    //     icon: 'bb',
    //     title: 'test bb',
    //     Render: () => 'content bbb'
    //   }
    // ],
    // turnFooterRenders: [
    //   {
    //     id: 'test',
    //     Render: ({ messages }) => `${messages.length}条消息`
    //   }
    // ]
  }
}

export default baseWebPlugin
