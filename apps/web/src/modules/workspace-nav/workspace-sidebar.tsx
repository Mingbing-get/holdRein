import { useCallback, useState } from "react";
import { FolderOpenOutlined } from "@ant-design/icons";
import { theme, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import {
  workspaceSummaries,
  type WorkspaceSummary
} from "../../shared/mock/workspaces";

const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 680;

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

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

export function WorkspaceSidebar() {
  const {
    state: { sidebarCollapsed, sidebarResizing, sidebarWidth },
    setSidebarResizing,
    setSidebarWidth
  } = useAppUi();
  const { token } = theme.useToken();
  const [isResizeHandleHovered, setIsResizeHandleHovered] = useState(false);
  const isResizeActive = sidebarResizing || isResizeHandleHovered;

  const startResizing = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const startX = event.clientX;
      const startWidth = sidebarWidth;
      setSidebarResizing(true);

      const resizeSidebar = (moveEvent: MouseEvent) => {
        setSidebarWidth(
          clampSidebarWidth(startWidth + moveEvent.clientX - startX)
        );
      };

      const stopResizing = () => {
        setSidebarResizing(false);
        document.removeEventListener("mousemove", resizeSidebar);
        document.removeEventListener("mouseup", stopResizing);
      };

      document.addEventListener("mousemove", resizeSidebar);
      document.addEventListener("mouseup", stopResizing);
    },
    [setSidebarResizing, setSidebarWidth, sidebarWidth]
  );

  return (
    <aside
      aria-label="Workspace sidebar"
      style={{
        borderRight: `1px solid ${
          isResizeActive ? token.colorPrimary : "rgba(127, 145, 170, 0.18)"
        }`,
        bottom: 0,
        color: "#eff5ff",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        left: 0,
        padding: 12,
        position: "fixed",
        top: 0,
        transition: sidebarResizing
          ? "transform 0.2s ease"
          : "transform 0.2s ease, width 0.2s ease",
        transform: sidebarCollapsed ? "translateX(-100%)" : "translateX(0)",
        visibility: sidebarCollapsed ? "hidden" : "visible",
        width: sidebarWidth
      }}
    >
      <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12 }}>
        {workspaceSummaries.map((workspace) => (
          <WorkspaceSection
            key={workspace.id}
            collapsed={sidebarCollapsed}
            workspace={workspace}
          />
        ))}
      </div>
      <div
        aria-label="Resize workspace sidebar"
        aria-orientation="vertical"
        onMouseDown={startResizing}
        onMouseEnter={() => {
          setIsResizeHandleHovered(true);
        }}
        onMouseLeave={() => {
          setIsResizeHandleHovered(false);
        }}
        role="separator"
        style={{
          bottom: 0,
          cursor: "col-resize",
          position: "absolute",
          right: -5,
          top: 0,
          width: 10
        }}
      />
    </aside>
  );
}
