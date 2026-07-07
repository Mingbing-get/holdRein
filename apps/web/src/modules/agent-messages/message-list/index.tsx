import { Alert, Flex, Typography } from "antd";
import { InfoCircleOutlined, RollbackOutlined } from "@ant-design/icons";
import { Bubble, Think } from "@ant-design/x";
import "./index.css";

import { useAppPlugins } from '../../../app/app-plugin';
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { getCalledSubagentId } from "../collection";
import { MarkdownContent } from "../markdown-content";
import { SubagentMessageList } from "../subagent-message";
import { Fragment, useLayoutEffect, useMemo } from "react";
import {
  useTaskMessage,
  useTaskMessages
} from "../tasks-context";
import {
  useTurnFooterMessageGroups,
  type TurnFooterStatus
} from "../use-turn-footer-message-groups";
import type { WebPlugin } from '@hold-rein/plugin-web'
import { customTypeMap } from "../consts";
import { getText, isContinueSentinel } from "./message-utils";
import {
  StaticToolCallMessageItem,
  StoredToolCallMessageItem
} from "./tool-call-message";

const EMPTY_AGENT_MESSAGES: WebPlugin.AgentMessage[] = [];

export interface AgentMessageListProps {
  messages?: WebPlugin.AgentMessage[];
  onMessageChange?: () => void;
  status?: TurnFooterStatus;
  taskId?: string;
}

export function AgentMessageList({
  messages = EMPTY_AGENT_MESSAGES,
  onMessageChange,
  status,
  taskId
}: AgentMessageListProps) {
  if (taskId) {
    return (
      <AgentStoredMessageList
        onMessageChange={onMessageChange}
        status={status}
        taskId={taskId}
      />
    );
  }

  return <AgentStaticMessageList messages={messages} status={status} />;
}

function AgentStaticMessageList({
  messages,
  status
}: {
  messages: WebPlugin.AgentMessage[];
  status?: TurnFooterStatus;
}) {
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const workspacePath = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.path,
    [activeWorkspaceId, workspaces]
  );
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
            <AgentMessageItem
              message={message}
              messages={messages}
              workspacePath={workspacePath}
            />
            {footerMessages ? (
              <AgentTurnFooter
                messages={footerMessages}
                workspacePath={workspacePath}
              />
            ) : null}
          </Fragment>
        );
      })}
    </Flex>
  );
}

function AgentStoredMessageList({
  onMessageChange,
  status,
  taskId
}: {
  onMessageChange?: (() => void) | undefined;
  status?: TurnFooterStatus;
  taskId: string;
}) {
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const messages = useTaskMessages(taskId);
  const workspacePath = useMemo(
    () =>
      workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.path,
    [activeWorkspaceId, workspaces]
  );
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
            <AgentStoredMessageItem
              messageId={message.id}
              onMessageChange={onMessageChange}
              taskId={taskId}
              workspacePath={workspacePath}
            />
            {footerMessages ? (
              <AgentTurnFooter
                messages={footerMessages}
                workspacePath={workspacePath}
              />
            ) : null}
          </Fragment>
        );
      })}
    </Flex>
  );
}

function AgentStoredMessageItem({
  messageId,
  onMessageChange,
  taskId,
  workspacePath
}: {
  messageId: string;
  onMessageChange?: (() => void) | undefined;
  taskId: string;
  workspacePath?: string | undefined;
}) {
  const message = useTaskMessage(taskId, messageId);

  useLayoutEffect(() => {
    if (message) onMessageChange?.();
  }, [message, onMessageChange]);

  return message ? (
    <AgentMessageItem
      message={message}
      messages={[]}
      taskId={taskId}
      workspacePath={workspacePath}
    />
  ) : null;
}

function AgentTurnFooter({
  messages,
  workspacePath
}: {
  messages: WebPlugin.AgentMessage[];
  workspacePath?: string | undefined;
}) {
  const { turnFooterRenders } = useAppPlugins();

  if (!turnFooterRenders.length) {
    return null;
  }

  return (
    <Flex data-testid="agent-turn-footer" gap={8} vertical>
      {turnFooterRenders.map(({ id, Render }) => (
        <Render key={id} messages={messages} workspacePath={workspacePath} />
      ))}
    </Flex>
  );
}

function AgentMessageItem({
  message,
  messages,
  taskId,
  workspacePath
}: {
  message: WebPlugin.AgentMessage;
  messages: WebPlugin.AgentMessage[];
  taskId?: string | undefined;
  workspacePath?: string | undefined;
}) {
  if (message.role === "user") {
    const content = getText(message.content);

    return (
      <div
        {...(content.trim() ? { "data-user-message-id": message.id } : {})}
      >
        <Bubble
          styles={{
            content: { padding: '8px 12px', minHeight: 'unset', maxHeight: '240px', overflowY: 'auto', borderRadius: 8 }
          }}
          content={content}
          placement="end"
        />
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <AssistantMessageItem
        message={message}
        messages={messages}
        taskId={taskId}
        workspacePath={workspacePath}
      />
    );
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
        title={customTypeMap[message.customType] || message.customType}
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
  messages,
  taskId,
  workspacePath
}: {
  message: WebPlugin.AssistantMessage;
  messages: WebPlugin.AgentMessage[];
  taskId?: string | undefined;
  workspacePath?: string | undefined;
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
              title="思考"
              defaultExpanded={false}
              blink
            >
              {block.thinking}
            </Think>
          );
        }
        return (
          taskId ? (
            <StoredToolCallMessageItem
              key={index}
              taskId={taskId}
              toolCall={block}
              workspacePath={workspacePath}
            />
          ) : (
            <StaticToolCallMessageItem
              key={index}
              messages={messages}
              toolCall={block}
              workspacePath={workspacePath}
            />
          )
        );
      })}
      {message.errorMessage ? <Alert type="error" title="Agent 错误" description={message.errorMessage} /> : null}
    </Flex>
  );
}
