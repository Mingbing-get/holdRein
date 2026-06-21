import type { WebPlugin } from '@hold-rein/plugin-web'
import TerminalIcon from './icon'

export function ShellExecToolRender(props: WebPlugin.ToolRenderProps) {
  return (
    <props.DefaultToolRender title='执行命令' icon={<TerminalIcon />}>
      { props.renderDefaultChildren() }
    </props.DefaultToolRender>
  )
}

export const shellExecTool: WebPlugin.ToolRender = {
  Render: ShellExecToolRender,
  toolName: 'shell_exec'
}
