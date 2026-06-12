## 待考虑任务

1. 文件长期记忆系统，提供search_memory、read_memory，默认嵌入记忆文件夹的结构，任务完成后重新启动一个agent来整理记忆提供write_memory、update_memory、search_memory、read_memory、list_memory_structure等工具

```ts
namespace WebPlugin {
  export interface Context {
    useAppUi: () => AppUiContextValue
  }

  export interface ToolRender {
    name: string
    Render: (props: { toolCall: ToolCall, result: ToolResultMessage }) => React.ReactNode
  }

  export interface Define {
    toolRenders?: ToolRender[]
    settings?: {
      title: string
      icon: React.ReactNode
      Panel: () => React.ReactNode
    }[]
    lefts?: {
      title: string
      icon: React.ReactNode
      Panel: () => React.ReactNode
    }[]
    senderActions?: {
      Render: () => React.ReactNode
    }[]
  }

  export type WithDynamicDefine = Define | ((context: Context) => Define | Promise<Define>)
}
```
