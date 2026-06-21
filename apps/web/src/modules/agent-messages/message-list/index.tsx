import { Alert, Flex, Typography } from "antd";
import { InfoCircleOutlined, RollbackOutlined, ToolOutlined } from "@ant-design/icons";
import { Bubble, Think } from "@ant-design/x";
import "./index.css";

import { useAppPlugins } from '../../../app/app-plugin';
import { getCalledSubagentId } from "../collection";
import { MarkdownContent } from "../markdown-content";
import { SubagentMessageList } from "../subagent-message";
import { Fragment, useCallback, useMemo } from "react";
import {
  useTurnFooterMessageGroups,
  type TurnFooterStatus
} from "../use-turn-footer-message-groups";
import type { WebPlugin } from '@hold-rein/plugin-web'

const AGENT_CONTINUE_PROMPT = "";

export interface AgentMessageListProps {
  messages: WebPlugin.AgentMessage[];
  status?: TurnFooterStatus;
}

export function AgentMessageList({ messages, status }: AgentMessageListProps) {
  const footerSourceMessages = useMemo(
    () => messages.filter((message) => !isContinueSentinel(message)),
    [messages]
  );
  const visibleMessages = useMemo(
    () => footerSourceMessages.filter((message) => message.role !== "toolResult"),
    [footerSourceMessages]
  );
  const footerGroups = useTurnFooterMessageGroups(footerSourceMessages, status);

  return (
    <Flex data-testid="agent-message-list" gap={12} vertical>
      {visibleMessages.map((message) => {
        const footerMessages = footerGroups[message.id];

        return (
          <Fragment key={message.id}>
            <AgentMessageItem message={message} messages={messages} />
            {footerMessages ? (
              <AgentTurnFooter messages={footerMessages} />
            ) : null}
          </Fragment>
        );
      })}
    </Flex>
  );
}

function AgentTurnFooter({
  messages
}: {
  messages: WebPlugin.AgentMessage[];
}) {
  return <div data-turn-message-count={messages.length}>footer example</div>;
}

function AgentMessageItem({
  message,
  messages
}: {
  message: WebPlugin.AgentMessage;
  messages: WebPlugin.AgentMessage[];
}) {
  if (message.role === "user") {
    return <Bubble content={getText(message.content)} placement="end" />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageItem message={message} messages={messages} />;
  }
  if (message.role === "toolResult") {
    return null;
  }
  if (message.role === "bashExecution") {
    return <Typography.Text code>{message.command}: {message.output}</Typography.Text>;
  }
  if (message.role === "custom") {
    const subagentId = getCalledSubagentId(message);

    if (subagentId) {
      return (
        <SubagentMessageList
          agentId={subagentId}
        />
      )
    }

    return message.display ? (
      <Think
        title={message.customType}
        icon={<RollbackOutlined />}
        defaultExpanded={false}
        blink
      >
        {getText(message.content)}
      </Think>
    ) : null;
  }

  return (
    <Think
      title={message.role}
      icon={<InfoCircleOutlined />}
      defaultExpanded={false}
      blink
    >
      {getText(message.summary)}
    </Think>
  )
}

function AssistantMessageItem({
  message,
  messages
}: {
  message: WebPlugin.AssistantMessage;
  messages: WebPlugin.AgentMessage[];
}) {
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
          return (
            <Think
              key={index}
              title="thinking"
              defaultExpanded={false}
              blink
            >
              {block.thinking}
            </Think>
          );
        }
        return (
          <ToolCallMessageItem
            key={index}
            messages={messages}
            toolCall={block}
          />
        );
      })}
      {message.errorMessage ? <Alert type="error" title="Agent 错误" description={message.errorMessage} /> : null}
    </Flex>
  );
}

function ToolCallMessageItem({
  messages,
  toolCall
}: {
  messages: WebPlugin.AgentMessage[];
  toolCall: WebPlugin.ToolCall;
}) {
  const { toolRenders } = useAppPlugins();

  const toolResult = useMemo(() => {
    return messages.find(
      (message): message is WebPlugin.ToolResultMessage =>
        message.role === "toolResult" && message.toolCallId === toolCall.id
    )
  }, [messages, toolCall.id]);

  const toolRender = useMemo(() => {
    return toolRenders.find(item => item.toolName === toolCall.name)
  }, [toolRenders, toolCall.name])

  const renderDefaultChildren = useCallback(() => (
    <div className="agent-tool-call">
      <ToolCallSection title="参数" value={formatToolValue(toolCall.arguments)} />
      {toolResult ? (
        <ToolCallSection
          danger={toolResult.isError}
          title="执行结果"
          value={toolResult ? getText(toolResult.content) : ""}
        />
      ) : null}
    </div>
  ), [toolCall, toolResult])

  if (toolRender) {
    return (
      <toolRender.Render
        toolCall={toolCall}
        DefaultToolRender={DefaultToolRender}
        renderDefaultChildren={renderDefaultChildren}
        {...(toolResult ? { result: toolResult } : {})}
      />
    )
  }

  return (
    <DefaultToolRender
      title={`run tool: ${toolCall.name}`}
      icon={<ToolOutlined />}
    >
      {renderDefaultChildren()}
    </DefaultToolRender>
  )
}

function DefaultToolRender({ icon, title, children }: WebPlugin.DefaultToolRenderProps) {
  return (
    <Think
      title={title}
      blink
      defaultExpanded={false}
      icon={icon}
    >
      {children}
    </Think>
  )
}

function ToolCallSection({
  danger,
  title,
  value
}: {
  danger?: boolean;
  title: string;
  value: string;
}) {
  return (
    <section className="agent-tool-call__section">
      <div className="agent-tool-call__section-title">{title}</div>
      <pre
        className={
          danger
            ? "agent-tool-call__content agent-tool-call__content--danger"
            : "agent-tool-call__content"
        }
      >
        {value || "(empty)"}
      </pre>
    </section>
  );
}

function formatToolValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getText(content: string | { type: string; text?: string }[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
}

function isContinueSentinel(message: WebPlugin.AgentMessage): boolean {
  return message.role === "user" && getText(message.content) === AGENT_CONTINUE_PROMPT;
}
