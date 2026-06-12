import { Divider, Flex } from "antd";
import { useLayoutEffect, useRef } from "react";

import { useAppWorkspace } from "../../app/app-workspace-context";
import {
  AgentMessageList,
  ApprovalPanel,
  useAgentTasks
} from "../agent-messages";
import { ModelSelector } from "./model-selector";
import Sender, { type SuggestionGroup } from "./sender";
import { WorkspaceSelector } from "./workspace-selector";

interface ChatWorkspaceProps {
  activeTaskName: string;
  apiBaseUrl: string;
}

const groups: SuggestionGroup[] = [
  {
    trigger: "/",
    suggestions: [
      {
        label: "Run release checklist",
        value: "/release checklist"
      },
      {
        label: "Review incidents",
        value: "/incidents review"
      },
      {
        label: "Prepare handoff",
        value: "/handoff summary"
      }
    ]
  }
]

const BOTTOM_TOLERANCE_PX = 2;

export function ChatWorkspace({
  activeTaskName,
  apiBaseUrl
}: ChatWorkspaceProps) {
  const {
    state: { activeAgent, activeTaskId, activeWorkspaceId, workspaces },
    setActiveAgent
  } = useAppWorkspace();
  const {
    continueTask,
    decideApproval,
    getPendingApproval,
    getTaskState,
    startTask
  } = useAgentTasks();
  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  );
  const taskState = getTaskState(activeTaskId);
  const pendingApproval = getPendingApproval(activeTaskId);
  const senderDisabled = !activeWorkspaceId || !activeAgent;
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousTaskIdRef = useRef(activeTaskId);
  const shouldFollowMessagesRef = useRef(true);

  useLayoutEffect(() => {
    if (previousTaskIdRef.current !== activeTaskId) {
      previousTaskIdRef.current = activeTaskId;
      shouldFollowMessagesRef.current = true;
    }

    if (shouldFollowMessagesRef.current) {
      bottomRef.current?.scrollIntoView?.({ block: "end" });
    }
  }, [activeTaskId, pendingApproval, taskState?.messages]);

  return (
    <Flex
      data-api-base-url={apiBaseUrl}
      data-task-name={activeTaskName}
      data-testid="chat-workspace"
      vertical
      style={{
        background: "transparent",
        flex: 1,
        overflow: "hidden",
        gap: 8
      }}
    >
      <Flex
        data-testid="chat-message-scroll"
        vertical
        gap={16}
        onScroll={(event) => {
          if (!event.isTrusted) {
            return;
          }

          const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
          shouldFollowMessagesRef.current =
            scrollHeight - clientHeight - scrollTop <= BOTTOM_TOLERANCE_PX;
        }}
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative"
        }}
      >
        <AgentMessageList messages={taskState?.messages ?? []} />
        {pendingApproval ? (
          <ApprovalPanel
            approval={pendingApproval}
            onDecide={(approved, reason) =>
              decideApproval(
                activeTaskId,
                pendingApproval.approvalId,
                approved,
                reason
              )
            }
          />
        ) : null}
        <div aria-hidden ref={bottomRef} />
      </Flex>

      <Sender
        disabled={senderDisabled}
        suggestionGroups={groups}
        autoSize={{ minRows: 1, maxRows: 4 }}
        footer={
          <Flex align="center">
            <WorkspaceSelector apiBaseUrl={apiBaseUrl} />
            <Divider
              orientation="vertical"
              style={{
                borderColor: "var(--app-color-border-secondary)"
              }}
            />
            <ModelSelector
              apiBaseUrl={apiBaseUrl}
              value={activeAgent ?? undefined}
              onChange={setActiveAgent}
            />
          </Flex>
        }
        onSubmit={async (message) => {
          if (!activeAgent || !activeWorkspace || !message.trim()) {
            return;
          }

          if (activeTaskId) {
            await continueTask(activeTaskId, {
              modelId: activeAgent.modelId,
              prompt: message,
              provider: activeAgent.providerId
            });
            return;
          }

          await startTask({
            modelId: activeAgent.modelId,
            prompt: message,
            provider: activeAgent.providerId,
            workspacePath: activeWorkspace.path
          });
        }}
      />
    </Flex>
  );
}
