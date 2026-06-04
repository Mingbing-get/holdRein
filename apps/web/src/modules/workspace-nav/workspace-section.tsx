import { useState } from "react";
import { FolderOpenOutlined } from "@ant-design/icons";
import { theme, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import type { WorkspaceSummary } from "../../shared/mock/workspaces";

export interface WorkspaceSectionProps {
  collapsed: boolean;
  workspace: WorkspaceSummary;
}

export function WorkspaceSection({
  workspace,
  collapsed
}: WorkspaceSectionProps) {
  const {
    state: { activeConversationId, activeWorkspaceId },
    setActiveConversationId,
    setActiveWorkspaceId
  } = useAppUi();
  const { token } = theme.useToken();
  const [hoveredConversationId, setHoveredConversationId] = useState<
    string | null
  >(null);
  const isActiveWorkspace = workspace.id === activeWorkspaceId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {!collapsed ? (
        <div
          data-testid={`workspace-group-${workspace.id}`}
          style={{ alignItems: "center", display: "flex", gap: 6 }}
        >
          <FolderOpenOutlined
            data-testid="workspace-folder-open-icon"
            style={{ color: token.colorTextSecondary, fontSize: 14 }}
          />
          <Typography.Text strong style={{ fontSize: 12, lineHeight: "20px" }}>
            {workspace.name}
          </Typography.Text>
        </div>
      ) : null}

      {workspace.conversations.map((conversation) => {
        const isActiveConversation =
          isActiveWorkspace && conversation.id === activeConversationId;

        return (
          <Typography.Text
            key={conversation.id}
            data-testid={`workspace-conversation-${conversation.id}`}
            onClick={() => {
              setActiveWorkspaceId(workspace.id);
              setActiveConversationId(conversation.id);
            }}
            onMouseEnter={() => {
              setHoveredConversationId(conversation.id);
            }}
            onMouseLeave={() => {
              setHoveredConversationId((currentConversationId) =>
                currentConversationId === conversation.id
                  ? null
                  : currentConversationId
              );
            }}
            ellipsis
            style={{
              background:
                isActiveConversation || hoveredConversationId === conversation.id
                  ? token.colorFillSecondary
                  : undefined,
              borderRadius: 6,
              cursor: "pointer",
              display: "block",
              fontSize: 12,
              fontWeight: 400,
              lineHeight: "20px",
              padding: collapsed ? "4px 6px" : "4px 8px 4px 20px",
              transition: "background-color 0.16s ease"
            }}
          >
            {collapsed ? conversation.shortLabel : conversation.name}
          </Typography.Text>
        );
      })}
    </div>
  );
}
