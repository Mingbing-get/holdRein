import { ToolOutlined } from "@ant-design/icons";
import { Think } from "@ant-design/x";
import { useCallback, useMemo } from "react";

import { useAppPlugins } from "../../../app/app-plugin";
import { useToolResultMessage } from "../tasks-context";
import { formatToolValue, getText } from "./message-utils";
import { ToolCallSection } from "./tool-call-section";
import type { WebPlugin } from "@hold-rein/plugin-web";

export function StaticToolCallMessageItem({
  messages,
  toolCall,
  workspacePath
}: {
  messages: WebPlugin.AgentMessage[];
  toolCall: WebPlugin.ToolCall;
  workspacePath?: string | undefined;
}) {
  const toolResult = useMemo(() => {
    return messages.find(
      (message): message is WebPlugin.ToolResultMessage =>
        message.role === "toolResult" && message.toolCallId === toolCall.id
    );
  }, [messages, toolCall.id]);

  return (
    <ToolCallMessageItem
      toolCall={toolCall}
      toolResult={toolResult}
      workspacePath={workspacePath}
    />
  );
}

export function StoredToolCallMessageItem({
  taskId,
  toolCall,
  workspacePath
}: {
  taskId: string;
  toolCall: WebPlugin.ToolCall;
  workspacePath?: string | undefined;
}) {
  const toolResult = useToolResultMessage(taskId, toolCall.id);

  return (
    <ToolCallMessageItem
      toolCall={toolCall}
      toolResult={toolResult}
      workspacePath={workspacePath}
    />
  );
}

function ToolCallMessageItem({
  toolCall,
  toolResult,
  workspacePath
}: {
  toolCall: WebPlugin.ToolCall;
  toolResult?: WebPlugin.ToolResultMessage | undefined;
  workspacePath?: string | undefined;
}) {
  const { toolRenders } = useAppPlugins();

  const toolRender = useMemo(() => {
    return toolRenders.find((item) => item.toolName === toolCall.name);
  }, [toolRenders, toolCall.name]);
  const canUseToolRender =
    toolCall.argumentsText === undefined || toolCall.argumentsParsed === true;
  const rawArgumentsText =
    toolCall.argumentsParsed === false ? toolCall.argumentsText : undefined;
  const shouldShowRawArguments = rawArgumentsText !== undefined;

  const renderDefaultChildren = useCallback(
    () => (
      <div className="agent-tool-call">
        <ToolCallSection
          title="参数"
          value={
            shouldShowRawArguments
              ? rawArgumentsText
              : formatToolValue(toolCall.arguments)
          }
        />
        {toolResult ? (
          <ToolCallSection
            danger={toolResult.isError}
            title="执行结果"
            value={getText(toolResult.content)}
          />
        ) : null}
      </div>
    ),
    [rawArgumentsText, shouldShowRawArguments, toolCall, toolResult]
  );

  if (toolRender && canUseToolRender) {
    return (
      <toolRender.Render
        toolCall={toolCall}
        DefaultToolRender={DefaultToolRender}
        renderDefaultChildren={renderDefaultChildren}
        workspacePath={workspacePath}
        {...(toolResult ? { result: toolResult } : {})}
      />
    );
  }

  return (
    <DefaultToolRender
      defaultExpanded={shouldShowRawArguments}
      title={`run tool: ${toolCall.name}`}
      icon={<ToolOutlined />}
    >
      {renderDefaultChildren()}
    </DefaultToolRender>
  );
}

function DefaultToolRender({
  defaultExpanded = false,
  icon,
  title,
  children
}: WebPlugin.DefaultToolRenderProps) {
  return (
    <Think
      title={title}
      blink
      defaultExpanded={defaultExpanded}
      icon={icon}
    >
      {children}
    </Think>
  );
}
