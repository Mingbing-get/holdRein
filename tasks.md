## 待考虑任务

1. 文件长期记忆系统，提供search_memory、read_memory，默认嵌入记忆文件夹的结构，任务完成后重新启动一个agent来整理记忆提供write_memory、update_memory、search_memory、read_memory、list_memory_structure等工具

## toolDefine

```ts
namespace ServerPlugin {
  export interface Context {
    env: ExecutionEnv;
    session: Session;
    model: Model<any>;
    thinkingLevel: ThinkingLevel;
    prompt: string;
  }

  type ToolExecuteBeforeResult = ToolCallResult | undefined

  export interface ToolBeforeExecuteOption {
    workspacePath: string
    event: ToolCallEvent
    approval: (title?: string) => Promise<ToolExecuteBeforeResult>
  }

  export interface ToolDefine extends AgentTool {
    beforeExecute: (options: ToolBeforeExecuteOption) => ToolExecuteBeforeResult | Promise<ToolExecuteBeforeResult>
  }

  export interface Define extends Partal<Pick<Context, 'model' | 'thinkingLevel'>> {
    tools?: ToolDefine[]
    /**
     * 会自动加载skillDirs下所有的skill，会合并skills
     */
    skills?: Skill[]
    skillDirs?: string[]
    systemPrompt?: string[]
    subscribe?: (event: AgentHarnessEvent) => void
  }

  export type WithDynamicDefine = Define | ((context: Context) => Define | Promise<Define>)
}

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
