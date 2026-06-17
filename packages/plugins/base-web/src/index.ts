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
    // ],
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
    // ]
  }
}

export default baseWebPlugin
