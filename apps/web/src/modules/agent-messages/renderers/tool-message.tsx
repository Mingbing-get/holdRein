import { Typography } from "antd";

import type { AgentMessage } from "../agent-message-types";

export function ToolMessage({ message }: { message: AgentMessage }) {
  return (
    <Typography.Text code style={{ color: "var(--app-color-text-secondary)" }}>
      {message.content}
    </Typography.Text>
  );
}
