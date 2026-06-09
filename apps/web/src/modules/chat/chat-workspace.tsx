import { Divider, Flex } from "antd";

import { useAppWorkspace } from "../../app/app-workspace-context";
import { AgentMessageList, useAgentTasks } from "../agent-messages";
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

export function ChatWorkspace({
  activeTaskName,
  apiBaseUrl
}: ChatWorkspaceProps) {
  const {
    state: { activeAgent, activeTaskId, activeWorkspaceId, workspaces },
    setActiveAgent
  } = useAppWorkspace();
  const { continueTask, getTaskState, startTask } = useAgentTasks();
  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId
  );
  const taskState = getTaskState(activeTaskId);
  const senderDisabled = !activeWorkspaceId || !activeAgent;

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
        vertical
        gap={16}
        style={{
          flex: 1,
          overflow: "auto",
        }}
      >
        <AgentMessageList messages={taskState?.messages ?? []} />
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
            await continueTask(activeTaskId, message);
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
