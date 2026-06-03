import { Button, Space, Tag, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import {
  workspaceSummaries,
  type WorkspaceSummary
} from "../../shared/mock/workspaces";

function WorkspaceSection({
  workspace,
  collapsed
}: {
  collapsed: boolean;
  workspace: WorkspaceSummary;
}) {
  const {
    state: { activeConversationId, activeWorkspaceId },
    setActiveConversationId,
    setActiveWorkspaceId
  } = useAppUi();
  const isActiveWorkspace = workspace.id === activeWorkspaceId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {!collapsed ? (
        <div>
          <Typography.Text strong style={{ fontSize: 12 }}>
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
              onClick={() => {
                setActiveWorkspaceId(workspace.id);
                setActiveConversationId(conversation.id);
              }}
              ellipsis
              strong={isActiveConversation}
              style={{
                display: "block",
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {collapsed ? conversation.shortLabel : conversation.name}
            </Typography.Text>
        );
      })}
    </div>
  );
}

export function WorkspaceSidebar() {
  const {
    state: { sidebarCollapsed },
    toggleSidebar
  } = useAppUi();

  return (
    <aside
      aria-label="Workspace sidebar"
      style={{
        borderRight: "1px solid rgba(127, 145, 170, 0.18)",
        bottom: 0,
        color: "#eff5ff",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        left: 0,
        padding: 12,
        position: "fixed",
        top: 0,
        transition: "width 0.2s ease",
        width: sidebarCollapsed ? 88 : 320
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: sidebarCollapsed ? "center" : "space-between"
        }}
      >
        <Button
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
          shape="circle"
        >
          {sidebarCollapsed ? ">" : "<"}
        </Button>
      </div>

      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12 }}>
        {workspaceSummaries.map((workspace) => (
          <WorkspaceSection
            key={workspace.id}
            collapsed={sidebarCollapsed}
            workspace={workspace}
          />
        ))}
      </div>
    </aside>
  );
}
