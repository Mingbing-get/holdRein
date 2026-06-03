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
          <Typography.Paragraph
            ellipsis={{ rows: 1 }}
            style={{ fontSize: 12, margin: "2px 0 0" }}
            type="secondary"
          >
            {workspace.path}
          </Typography.Paragraph>
        </div>
      ) : null}

      {workspace.conversations.map((conversation) => {
        const isActiveConversation =
          isActiveWorkspace && conversation.id === activeConversationId;

        return (
          <button
            key={conversation.id}
            onClick={() => {
              setActiveWorkspaceId(workspace.id);
              setActiveConversationId(conversation.id);
            }}
            style={{
              background: isActiveConversation
                ? "rgba(31,111,235,0.14)"
                : "transparent",
              border: "1px solid rgba(127, 145, 170, 0.14)",
              borderRadius: 12,
              color: "inherit",
              cursor: "pointer",
              padding: collapsed ? "8px 6px" : "8px 10px",
              textAlign: "left"
            }}
            type="button"
          >
            <Typography.Text
              ellipsis
              strong={isActiveConversation}
              style={{
                display: "block",
                fontSize: 12
              }}
            >
              {collapsed ? conversation.shortLabel : conversation.name}
            </Typography.Text>
          </button>
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
        background: "rgba(10, 18, 30, 0.92)",
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
        {!sidebarCollapsed ? (
          <div>
            <Typography.Text
              style={{
                color: "#eff5ff",
                display: "block",
                fontSize: 12
              }}
              strong
            >
              Workspaces
            </Typography.Text>
            <Typography.Text style={{ color: "rgba(239,245,255,0.72)" }}>
              Folder-scoped chats
            </Typography.Text>
          </div>
        ) : null}
        <Button
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
          shape="circle"
        >
          {sidebarCollapsed ? ">" : "<"}
        </Button>
      </div>

      <div
        style={{
          background: "rgba(239,245,255,0.06)",
          border: "1px solid rgba(239,245,255,0.1)",
          borderRadius: 14,
          padding: sidebarCollapsed ? 8 : 10
        }}
      >
        {sidebarCollapsed ? (
          <Typography.Text style={{ color: "#eff5ff" }} strong>
            FS
          </Typography.Text>
        ) : (
          <Space orientation="vertical" size={6}>
            <Tag color="blue" variant="filled">
              Folder Selector
            </Tag>
            <Typography.Text style={{ color: "#eff5ff", fontSize: 12 }} strong>
              Choose a local project folder
            </Typography.Text>
            <Typography.Text
              style={{ color: "rgba(239,245,255,0.72)", fontSize: 12 }}
            >
              This entry point will later open the custom directory picker driven
              by the backend.
            </Typography.Text>
          </Space>
        )}
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
