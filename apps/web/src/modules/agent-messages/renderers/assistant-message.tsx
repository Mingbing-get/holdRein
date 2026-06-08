import { Bubble } from "@ant-design/x";

import type { AgentMessage } from "../agent-message-types";

export function AssistantMessage({ message }: { message: AgentMessage }) {
  return <Bubble content={message.content} />;
}
