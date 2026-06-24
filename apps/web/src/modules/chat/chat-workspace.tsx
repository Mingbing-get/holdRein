import { Flex } from "antd";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useAppWorkspace } from "../../app/app-workspace-context";
import {
  AgentMessageList,
  ApprovalPanel,
  useAgentTasks
} from "../agent-messages";
import Sender from "./sender";
import {
  DEFAULT_APPROVAL_POLICY,
  DEFAULT_THINKING_LEVEL,
  normalizeApprovalPolicy,
  normalizeThinkingLevel
} from "./sender/task-options";
import { useWorkspaceFileSuggestions } from "./use-workspace-file-suggestions";

interface ChatWorkspaceProps {
  activeTaskName: string;
  apiBaseUrl: string;
}

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
    cancelTask,
    continueTask,
    decideApproval,
    getPendingApproval,
    getTaskState,
    startTask
  } = useAgentTasks();
  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  );
  const activeWorkspaceTask = activeWorkspace?.tasks.find(
    (task) => task.id === activeTaskId
  );
  const taskState = getTaskState(activeTaskId);
  const pendingApproval = getPendingApproval(activeTaskId);
  const suggestionGroups = useWorkspaceFileSuggestions(
    apiBaseUrl,
    taskState?.status
  );
  const senderDisabled = !activeWorkspaceId || !activeAgent;
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousTaskIdRef = useRef(activeTaskId);
  const shouldFollowMessagesRef = useRef(true);
  const [thinkingLevel, setThinkingLevel] = useState(DEFAULT_THINKING_LEVEL);
  const [approvalPolicy, setApprovalPolicy] = useState(DEFAULT_APPROVAL_POLICY);
  const activeWorkspaceTaskModelId =
    activeWorkspaceTask?.lastModelId ?? activeWorkspaceTask?.lastModelName;
  const activeWorkspaceTaskProvider = activeWorkspaceTask?.lastModelProvider;

  useEffect(() => {
    setThinkingLevel(normalizeThinkingLevel(activeWorkspaceTask?.thinkingLevel));
    setApprovalPolicy(
      normalizeApprovalPolicy(activeWorkspaceTask?.approvalPolicy)
    );
    if (activeWorkspaceTaskModelId && activeWorkspaceTaskProvider) {
      setActiveAgent({
        modelId: activeWorkspaceTaskModelId,
        providerId: activeWorkspaceTaskProvider
      });
    }
  }, [
    activeTaskId,
    activeWorkspaceTask?.approvalPolicy,
    activeWorkspaceTask?.thinkingLevel,
    activeWorkspaceTaskModelId,
    activeWorkspaceTaskProvider,
    setActiveAgent
  ]);

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
        <AgentMessageList
          messages={taskState?.messages ?? []}
          status={taskState?.status}
        />
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
        activeAgent={activeAgent}
        approvalPolicy={approvalPolicy}
        apiBaseUrl={apiBaseUrl}
        disabled={senderDisabled}
        draftKey="chat-workspace-sender"
        running={taskState?.status === "running"}
        suggestionGroups={suggestionGroups}
        taskId={activeTaskId}
        thinkingLevel={thinkingLevel}
        workspacePath={activeWorkspace?.path}
        autoSize={{ minRows: 1, maxRows: 4 }}
        onActiveAgentChange={setActiveAgent}
        onApprovalPolicyChange={setApprovalPolicy}
        onCancel={async () => {
          if (!activeTaskId) {
            return;
          }

          await cancelTask(activeTaskId);
        }}
        onThinkingLevelChange={setThinkingLevel}
        onSubmit={async (message) => {
          if (!activeAgent || !activeWorkspace || !message.trim()) {
            return;
          }

          if (activeTaskId) {
            await continueTask(activeTaskId, {
              approvalPolicy,
              modelId: activeAgent.modelId,
              prompt: message,
              provider: activeAgent.providerId,
              thinkingLevel
            });
            return;
          }

          await startTask({
            approvalPolicy,
            modelId: activeAgent.modelId,
            prompt: message,
            provider: activeAgent.providerId,
            thinkingLevel,
            workspacePath: activeWorkspace.path
          });
        }}
      />
    </Flex>
  );
}
