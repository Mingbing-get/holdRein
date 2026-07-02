import { useState } from "react";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { Button, Dropdown, Typography } from "antd";

import type { WorkspaceSummary } from "../workspace-nav-types";

export interface WorkspaceHeadingProps {
  collapsed: boolean;
  onDelete: () => void;
  onOpenSettings: () => void;
  onOpenScheduledTasks: () => void;
  onStartNewConversation: () => void;
  onToggleCollapsed: () => void;
  workspace: WorkspaceSummary;
}

export function WorkspaceHeading({
  collapsed,
  onDelete,
  onOpenSettings,
  onOpenScheduledTasks,
  onStartNewConversation,
  onToggleCollapsed,
  workspace
}: WorkspaceHeadingProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-testid={`workspace-heading-${workspace.id}`}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{
        alignItems: "center",
        display: "flex",
        minWidth: 0,
        height: 22
      }}
    >
      <button
        aria-expanded={!collapsed}
        aria-label={`${collapsed ? "展开" : "折叠"}工作空间 ${workspace.name}`}
        data-testid={`workspace-group-${workspace.id}`}
        onClick={onToggleCollapsed}
        style={{
          alignItems: "center",
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "var(--app-color-text)",
          cursor: "pointer",
          display: "flex",
          flex: 1,
          fontFamily: "inherit",
          gap: 6,
          minWidth: 0,
          padding: 0,
          textAlign: "left"
        }}
        type="button"
      >
        {collapsed ? (
          <FolderOutlined
            data-testid="workspace-folder-icon"
            style={{ color: "var(--app-color-text-secondary)", fontSize: 14 }}
          />
        ) : (
          <FolderOpenOutlined
            data-testid="workspace-folder-open-icon"
            style={{ color: "var(--app-color-text-secondary)", fontSize: 14 }}
          />
        )}
        <Typography.Text
          ellipsis
          strong
          style={{ fontSize: 12, lineHeight: "20px" }}
        >
          {workspace.name}
        </Typography.Text>
      </button>
      {hovered || actionsOpen ? (
        <Dropdown
          menu={{
            items: [
              {
                icon: (
                  <PlusOutlined data-testid="workspace-new-conversation-icon" />
                ),
                key: "new-conversation",
                label: "新对话",
                onClick: onStartNewConversation
              },
              {
                icon: (
                  <ClockCircleOutlined data-testid="workspace-scheduled-tasks-icon" />
                ),
                key: "scheduled-tasks",
                label: "定时任务",
                onClick: onOpenScheduledTasks
              },
              {
                icon: <SettingOutlined data-testid="workspace-settings-icon" />,
                key: "settings",
                label: "设置",
                onClick: onOpenSettings
              },
              {
                danger: true,
                icon: <DeleteOutlined data-testid="workspace-delete-icon" />,
                key: "delete",
                label: "删除",
                onClick: onDelete
              }
            ]
          }}
          onOpenChange={setActionsOpen}
          open={actionsOpen}
          trigger={["hover", "click"]}
        >
          <Button
            aria-label={`工作空间操作 ${workspace.name}`}
            icon={<EllipsisOutlined />}
            onClick={(event) => {
              event.stopPropagation();
            }}
            size="small"
            type="text"
          />
        </Dropdown>
      ) : null}
    </div>
  );
}
