import { CodeOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { ShellProcessesPanel } from "./ShellProcessesPanel";

interface CreateShellProcessesOptions {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function createShellProcesses({
  request
}: CreateShellProcessesOptions): WebPlugin.RightPanel {
  return {
    id: "shell-processes",
    icon: <CodeOutlined aria-hidden="true" />,
    title: "Shell commands",
    Render: (props) => (
      <ShellProcessesPanel
        {...props}
        request={request}
      />
    )
  };
}
