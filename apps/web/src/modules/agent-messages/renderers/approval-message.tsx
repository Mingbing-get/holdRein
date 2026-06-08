import { Flex, Typography } from "antd";

import type { AgentMessage } from "../agent-message-types";

export function ApprovalMessage({ message }: { message: AgentMessage }) {
  return (
    <Flex gap={8} vertical>
      <Typography.Text strong>需要批准</Typography.Text>
      <Typography.Text code>{message.content}</Typography.Text>
    </Flex>
  );
}
