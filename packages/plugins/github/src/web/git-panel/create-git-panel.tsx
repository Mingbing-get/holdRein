import { GithubOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { GitPanel } from "./git-panel";

interface CreateGitPanelOptions {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function createGitPanel({
  request
}: CreateGitPanelOptions): WebPlugin.RightPanel {
  return {
    id: "git-repository",
    icon: <GithubOutlined aria-hidden="true" />,
    title: "Git",
    Render: (props) => <GitPanel {...props} request={request} />
  };
}
