import { PlusOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { WorkspaceSection } from "../workspace-section";

export function WorkspaceNav({ apiBaseUrl }: { apiBaseUrl: string }) {
  const {
    openChatWorkspace,
    state: { sidebarCollapsed }
  } = useAppUi();
  const {
    state: { activeWorkspaceId, workspaces },
    startNewConversation
  } = useAppWorkspace();
  const hasActiveWorkspace = workspaces.some(
    (workspace) => workspace.id === activeWorkspaceId
  );

  return (
    <nav
      aria-label="Workspace navigation"
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        gap: 12,
        minHeight: 0,
        overflow: "hidden"
      }}
    >
      <Button
        aria-label="开启新任务"
        block
        disabled={!hasActiveWorkspace}
        icon={<PlusOutlined />}
        onClick={() => {
          startNewConversation(activeWorkspaceId);
          openChatWorkspace();
        }}
        style={{
          borderColor: "var(--app-color-border-secondary)",
          borderRadius: 6,
          color: "var(--app-color-text)",
          fontSize: 12,
          flexShrink: 0
        }}
        type="text"
      >
        开启新任务
      </Button>
      <div
        aria-label="Workspace and task navigation"
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
          overflowY: "auto"
        }}
      >
        {workspaces.length === 0 && !sidebarCollapsed ? (
          <Typography.Text
            data-testid="workspace-sidebar-empty"
            style={{
              color: "var(--app-color-text-secondary)",
              display: "block",
              fontSize: 12,
              lineHeight: "20px",
              padding: "4px 8px",
              textAlign: "center"
            }}
          >
            暂无任务
          </Typography.Text>
        ) : null}
        {workspaces.map((workspace) => (
          <WorkspaceSection
            apiBaseUrl={apiBaseUrl}
            collapsed={sidebarCollapsed}
            key={workspace.id}
            workspace={workspace}
          />
        ))}
      </div>
    </nav>
  );
}
