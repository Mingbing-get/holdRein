import { Alert, Typography } from "antd";

import type { AgentMessage } from "../agent-message-types";

export function FallbackMessage({ message }: { message: AgentMessage }) {
  return (
    <Alert
      description={message.content}
      title={
        <Typography.Text>
          {message.kind === "error" ? "Agent 错误" : message.eventType ?? "事件"}
        </Typography.Text>
      }
      type={message.kind === "error" ? "error" : "info"}
    />
  );
}
