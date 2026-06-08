import { useState } from "react";
import { FolderOpenOutlined } from "@ant-design/icons";
import { Typography } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import type {
  WorkspaceSummary,
  WorkspaceTaskSummary
} from "../workspace-nav-types";

export interface WorkspaceSectionProps {
  collapsed: boolean;
  workspace: WorkspaceSummary;
}

export function WorkspaceSection({
  collapsed,
  workspace
}: WorkspaceSectionProps) {
  const {
    openChatWorkspace
  } = useAppUi();
  const {
    state: { activeTaskId, activeWorkspaceId },
    setActiveTaskId,
    setActiveWorkspaceId
  } = useAppWorkspace();
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
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
            style={{ color: "var(--app-color-text-secondary)", fontSize: 14 }}
          />
          <Typography.Text strong style={{ fontSize: 12, lineHeight: "20px" }}>
            {workspace.name}
          </Typography.Text>
        </div>
      ) : null}

      {workspace.tasks.map((task) => {
        const isActiveTask = isActiveWorkspace && task.id === activeTaskId;

        return (
          <Typography.Text
            data-testid={`workspace-task-${task.id}`}
            ellipsis
            key={task.id}
            onClick={() => {
              setActiveWorkspaceId(workspace.id);
              setActiveTaskId(task.id);
              openChatWorkspace();
            }}
            onMouseEnter={() => {
              setHoveredTaskId(task.id);
            }}
            onMouseLeave={() => {
              setHoveredTaskId((currentTaskId) =>
                currentTaskId === task.id ? null : currentTaskId
              );
            }}
            style={{
              background:
                isActiveTask || hoveredTaskId === task.id
                  ? "var(--app-color-fill-secondary)"
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
            {collapsed ? getTaskShortLabel(task) : task.title}
          </Typography.Text>
        );
      })}
    </div>
  );
}

function getTaskShortLabel(task: WorkspaceTaskSummary): string {
  return task.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
