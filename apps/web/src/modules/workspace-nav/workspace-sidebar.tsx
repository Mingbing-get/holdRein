import { useCallback, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";

import { useAppUi } from "../../app/app-ui-context";
import { WorkspaceSection } from "./workspace-section";
import type { WorkspaceSummary } from "./workspace-nav-types";

const MIN_SIDEBAR_WIDTH = 120;
const MAX_SIDEBAR_WIDTH = 680;

interface WorkspaceSidebarProps {
  workspaces: WorkspaceSummary[];
}

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function WorkspaceSidebar({ workspaces }: WorkspaceSidebarProps) {
  const {
    state: { sidebarCollapsed, sidebarResizing, sidebarWidth },
    setSidebarResizing,
    setSidebarWidth
  } = useAppUi();
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
          isResizeActive
            ? "var(--app-color-primary)"
            : "var(--app-color-border-secondary)"
        }`,
        bottom: 0,
        color: "var(--app-color-text)",
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
        <Button
          aria-label="开启新对话"
          icon={<PlusOutlined />}
          block
          style={{
            borderColor: "var(--app-color-border-secondary)",
            borderRadius: 6,
            color: "var(--app-color-text)",
            fontSize: 12
          }}
          type="text"
        >
          开启新对话
        </Button>
        {workspaces.length === 0 && !sidebarCollapsed ? (
          <Typography.Text
            data-testid="workspace-sidebar-empty"
            style={{
              color: "var(--app-color-text-secondary)",
              display: "block",
              fontSize: 12,
              lineHeight: "20px",
              padding: "4px 8px",
              textAlign: 'center'
            }}
          >
            暂无对话
          </Typography.Text>
        ) : null}
        {workspaces.map((workspace) => (
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
