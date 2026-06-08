import { Flex } from "antd";

import type { AgentMessage } from "./agent-message-types";
import { ApprovalMessage } from "./renderers/approval-message";
import { AssistantMessage } from "./renderers/assistant-message";
import { FallbackMessage } from "./renderers/fallback-message";
import { ThinkingMessage } from "./renderers/thinking-message";
import { ToolMessage } from "./renderers/tool-message";
import { UserMessage } from "./renderers/user-message";

export function AgentMessageList({ messages }: { messages: AgentMessage[] }) {
  return (
    <Flex data-testid="agent-message-list" gap={12} vertical>
      {messages.map((message) => (
        <AgentMessageItem key={message.id} message={message} />
      ))}
    </Flex>
  );
}

function AgentMessageItem({ message }: { message: AgentMessage }) {
  switch (message.kind) {
    case "user":
      return <UserMessage message={message} />;
    case "assistant":
      return <AssistantMessage message={message} />;
    case "thinking":
      return <ThinkingMessage message={message} />;
    case "tool":
      return <ToolMessage message={message} />;
    case "approval":
      return <ApprovalMessage message={message} />;
    case "error":
    case "fallback":
      return <FallbackMessage message={message} />;
  }
}
