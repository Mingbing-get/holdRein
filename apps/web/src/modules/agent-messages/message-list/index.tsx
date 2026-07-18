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
  useAgentMessage,
  useAgentMessages
} from "../tasks-context";
import {
  useTurnFooterMessageGroups,
  type TurnFooterStatus
} from "../use-turn-footer-message-groups";
import type { WebPlugin } from '@hold-rein/plugin-web'
import { customTypeMap } from "../consts";
import { getText, isContinueSentinel } from "./message-utils";
import { StoredToolCallMessageItem } from "./tool-call-message";

export interface AgentMessageListProps {
  onMessageChange?: () => void;
  status?: TurnFooterStatus;
  agentId: string;
}

export function AgentMessageList({
  onMessageChange,
  status,
  agentId
}: AgentMessageListProps) {
  const {
    state: { activeWorkspaceId, workspaces }
  } = useAppWorkspace();
  const messages = useAgentMessages(agentId);
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
              agentId={agentId}
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
  agentId,
  workspacePath
}: {
  messageId: string;
  onMessageChange?: (() => void) | undefined;
  agentId: string;
  workspacePath?: string | undefined;
}) {
  const message = useAgentMessage(agentId, messageId);

  useLayoutEffect(() => {
    if (message) onMessageChange?.();
  }, [message, onMessageChange]);

  return message ? (
    <AgentMessageItem
      message={message}
      agentId={agentId}
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
  agentId,
  workspacePath
}: {
  message: WebPlugin.AgentMessage;
  agentId: string;
  workspacePath?: string | undefined;
}) {
  if (message.role === "user") {
    const content = getText(message.content);
    const images =
      typeof message.content === "string"
        ? []
        : message.content.filter((block) => block.type === "image");

    return (
      <div
        {...(content.trim() ? { "data-user-message-id": message.id } : {})}
      >
        <Bubble
          styles={{
            content: { padding: '8px 12px', minHeight: 'unset', maxHeight: '240px', overflowY: 'auto', borderRadius: 8 }
          }}
          content={
            <Flex gap={8} vertical>
              {content ? <span>{content}</span> : null}
              {images.length ? (
                <Flex gap={6} wrap="wrap">
                  {images.map((image, index) => (
                    <img
                      alt={`用户图片 ${index + 1}`}
                      key={index}
                      src={`data:${image.mimeType};base64,${image.data}`}
                      style={{
                        borderRadius: 6,
                        maxHeight: 120,
                        maxWidth: 160,
                        objectFit: "cover"
                      }}
                    />
                  ))}
                </Flex>
              ) : null}
            </Flex>
          }
          placement="end"
        />
      </div>
    );
  }
  if (message.role === "assistant") {
    return (
      <AssistantMessageItem
        message={message}
        agentId={agentId}
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
  agentId,
  workspacePath
}: {
  message: WebPlugin.AssistantMessage;
  agentId: string;
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
          <StoredToolCallMessageItem
            key={index}
            agentId={agentId}
            toolCall={block}
            workspacePath={workspacePath}
          />
        );
      })}
      {message.errorMessage ? <Alert type="error" title="Agent 错误" description={message.errorMessage} /> : null}
    </Flex>
  );
}
