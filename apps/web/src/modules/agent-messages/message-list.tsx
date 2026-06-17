import { Alert, Flex, Typography } from "antd";
import { ToolOutlined } from "@ant-design/icons";
import { Bubble, Think } from "@ant-design/x";
import "./message-list.css";

import { useAppWorkspace } from "../../app/app-workspace-context";
import { useAppPlugins } from '../../app/app-plugin';
import { useAgentTasks } from "./agent-tasks-context";
import { MarkdownContent } from "./markdown-content";
import { useCallback, useMemo } from "react";
import type { WebPlugin } from '@hold-rein/plugin-web'

const AGENT_CONTINUE_PROMPT = "__continue__";

export function AgentMessageList({ messages }: { messages: WebPlugin.AgentMessage[] }) {
  return (
    <Flex data-testid="agent-message-list" gap={12} vertical>
      {messages
        .filter((message) => message.role !== "toolResult" && !isContinueSentinel(message))
        .map((message) => (
          <AgentMessageItem key={message.id} message={message} />
        ))}
    </Flex>
  );
}

function AgentMessageItem({ message }: { message: WebPlugin.AgentMessage }) {
  if (message.role === "user") {
    return <Bubble content={getText(message.content)} placement="end" />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageItem message={message} />;
  }
  if (message.role === "toolResult") {
    return null;
  }
  if (message.role === "bashExecution") {
    return <Typography.Text code>{message.command}: {message.output}</Typography.Text>;
  }
  if (message.role === "custom") {
    return message.display ? <Alert title={message.customType} description={getText(message.content)} /> : null;
  }
  return <Alert title={message.role} description={message.summary} />;
}

function AssistantMessageItem({ message }: { message: WebPlugin.AssistantMessage }) {
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
        return <ToolCallMessageItem key={index} toolCall={block} />;
      })}
      {message.errorMessage ? <Alert type="error" title="Agent 错误" description={message.errorMessage} /> : null}
    </Flex>
  );
}

function ToolCallMessageItem({ toolCall }: { toolCall: WebPlugin.ToolCall }) {
  const {
    state: { activeTaskId }
  } = useAppWorkspace();
  const { getTaskState } = useAgentTasks();
  const { toolRenders } = useAppPlugins();

  const toolResult = useMemo(() => {
    return getTaskState(activeTaskId)?.messages.find(
      (message): message is WebPlugin.ToolResultMessage =>
        message.role === "toolResult" && message.toolCallId === toolCall.id
    )
  }, [activeTaskId, getTaskState, toolCall.id]);

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
