import { ToolOutlined } from '@ant-design/icons'
import type { WebPlugin } from '@hold-rein/plugin-web'

export function CallSubagentToolRender(props: WebPlugin.ToolRenderProps) {
  return (
    <props.DefaultToolRender title='启动子智能体' icon={<ToolOutlined />}>
      { props.renderDefaultChildren() }
    </props.DefaultToolRender>
  )
}

export const callSubagentTool: WebPlugin.ToolRender = {
  Render: CallSubagentToolRender,
  toolName: 'call_subagent'
}
