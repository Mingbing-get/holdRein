import { ApiOutlined } from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function RequestSelfApiToolRender(props: WebPlugin.ToolRenderProps) {
  return (
    <props.DefaultToolRender
      icon={<ApiOutlined aria-hidden="true" />}
      title={`自我管理：${getRequestPathTitle(props.toolCall)}`}
    >
      {props.renderDefaultChildren()}
    </props.DefaultToolRender>
  );
}

export const requestSelfApiToolRender: WebPlugin.ToolRender = {
  Render: RequestSelfApiToolRender,
  toolName: "requestSelfApi"
};

function getRequestPathTitle(toolCall: WebPlugin.ToolCall): string {
  const path = toolCall.arguments.path;
  return typeof path === "string" && path.length > 0 ? path : toolCall.name;
}
