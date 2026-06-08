import { PlusOutlined } from "@ant-design/icons";
import { Button, Typography } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { WorkspaceSection } from "../workspace-section";

export function WorkspaceNav() {
  const {
    state: { sidebarCollapsed }
  } = useAppUi();
  const {
    state: { workspaces }
  } = useAppWorkspace();

  return (
    <nav
      aria-label="Workspace navigation"
      style={{ display: "flex", flex: 1, flexDirection: "column", gap: 12 }}
    >
      <Button
        aria-label="开启新任务"
        block
        icon={<PlusOutlined />}
        style={{
          borderColor: "var(--app-color-border-secondary)",
          borderRadius: 6,
          color: "var(--app-color-text)",
          fontSize: 12
        }}
        type="text"
      >
        开启新任务
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
            textAlign: "center"
          }}
        >
          暂无任务
        </Typography.Text>
      ) : null}
      {workspaces.map((workspace) => (
        <WorkspaceSection
          collapsed={sidebarCollapsed}
          key={workspace.id}
          workspace={workspace}
        />
      ))}
    </nav>
  );
}
