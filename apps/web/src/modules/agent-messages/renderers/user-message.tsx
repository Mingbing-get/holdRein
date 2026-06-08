import { Bubble } from "@ant-design/x";

import type { AgentMessage } from "../agent-message-types";

export function UserMessage({ message }: { message: AgentMessage }) {
  return <Bubble content={message.content} placement="end" />;
}
