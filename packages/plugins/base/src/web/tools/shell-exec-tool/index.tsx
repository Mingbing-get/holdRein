import type { WebPlugin } from '@hold-rein/plugin-web'
import TerminalIcon from './icon'

interface ShellToolRenderProps extends WebPlugin.ToolRenderProps {
  readonly title: string
}

function ShellToolRender({ title, ...props }: ShellToolRenderProps) {
  return (
    <props.DefaultToolRender title={title} icon={<TerminalIcon />}>
      { props.renderDefaultChildren() }
    </props.DefaultToolRender>
  )
}

export function ShellExecToolRender(props: WebPlugin.ToolRenderProps) {
  return <ShellToolRender {...props} title='执行命令' />
}

export function ShellReadToolRender(props: WebPlugin.ToolRenderProps) {
  return <ShellToolRender {...props} title='读取命令输出' />
}

export function ShellKillToolRender(props: WebPlugin.ToolRenderProps) {
  return <ShellToolRender {...props} title='终止命令' />
}

export const shellExecTool: WebPlugin.ToolRender = {
  Render: ShellExecToolRender,
  toolName: 'shell_exec'
}

export const shellReadTool: WebPlugin.ToolRender = {
  Render: ShellReadToolRender,
  toolName: 'shell_read'
}

export const shellKillTool: WebPlugin.ToolRender = {
  Render: ShellKillToolRender,
  toolName: 'shell_kill'
}
