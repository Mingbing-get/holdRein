import { ToolOutlined } from '@ant-design/icons'
import type { WebPlugin } from '@hold-rein/plugin-web'

export function RevokeSubagentToolRender(props: WebPlugin.ToolRenderProps) {
  return (
    <props.DefaultToolRender title='重启子智能体' icon={<ToolOutlined />}>
      { props.renderDefaultChildren() }
    </props.DefaultToolRender>
  )
}

export const revokeSubagentTool: WebPlugin.ToolRender = {
  Render: RevokeSubagentToolRender,
  toolName: 'revoke_subagent'
}
