import { Alert, Flex, Typography } from "antd";
import { Bubble, Think } from "@ant-design/x";

import type { AgentMessage, AssistantMessage } from "./agent-message-types";
import { MarkdownContent } from "./markdown-content";

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
  if (message.role === "user") {
    return <Bubble content={getText(message.content)} placement="end" />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageItem message={message} />;
  }
  if (message.role === "toolResult") {
    return (
      <Typography.Text code {...(message.isError ? { type: "danger" as const } : {})}>
        {message.toolName}: {getText(message.content)}
      </Typography.Text>
    );
  }
  if (message.role === "bashExecution") {
    return <Typography.Text code>{message.command}: {message.output}</Typography.Text>;
  }
  if (message.role === "custom") {
    return message.display ? <Alert title={message.customType} description={getText(message.content)} /> : null;
  }
  return <Alert title={message.role} description={message.summary} />;
}

function AssistantMessageItem({ message }: { message: AssistantMessage }) {
  return (
    <Flex gap={8} vertical>
      {message.content.map((block, index) => {
        if (block.type === "text") {
          return (
            <Bubble
              key={index}
              content={<MarkdownContent>{block.text}</MarkdownContent>}
              variant="borderless"
            />
          );
        }
        if (block.type === "thinking") {
          return <Think key={index} title="思考过程">{block.thinking}</Think>;
        }
        return <Typography.Text code key={index}>{block.name}</Typography.Text>;
      })}
      {message.errorMessage ? <Alert type="error" title="Agent 错误" description={message.errorMessage} /> : null}
    </Flex>
  );
}

function getText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}
