import { useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined
} from "@ant-design/icons";
import { Button, Dropdown, Spin, Tag, Typography } from "antd";

import type { WorkspaceTaskSummary } from "../workspace-nav-types";

export interface WorkspaceTaskProps {
  collapsed: boolean;
  hasPendingApproval: boolean;
  hasUnreadCompletion: boolean;
  isActive: boolean;
  onDelete: (task: WorkspaceTaskSummary) => void;
  onOpen: (task: WorkspaceTaskSummary) => void;
  onRename: (task: WorkspaceTaskSummary, visibleTitle: string) => void;
  task: WorkspaceTaskSummary;
}

export function WorkspaceTask({
  collapsed,
  hasPendingApproval,
  hasUnreadCompletion,
  isActive,
  onDelete,
  onOpen,
  onRename,
  task
}: WorkspaceTaskProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visibleTitle = getTaskVisibleTitle(task);
  const showActions = !collapsed && (hovered || actionsOpen);

  return (
    <div
      data-testid={`workspace-task-${task.id}`}
      onClick={() => {
        onOpen(task);
      }}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      style={{
        alignItems: "center",
        background:
          isActive || hovered ? "var(--app-color-fill-secondary)" : undefined,
        borderRadius: 6,
        cursor: "pointer",
        display: "flex",
        fontSize: 12,
        fontWeight: 400,
        gap: 4,
        lineHeight: "20px",
        height: 30,
        padding: collapsed ? "4px 6px" : "4px 8px 4px 20px",
        transition: "background-color 0.16s ease"
      }}
    >
      <Typography.Text
        data-testid={`task-title-${task.id}`}
        ellipsis
        style={{
          color:
            task.status === "error" ? "var(--app-color-danger)" : undefined,
          flex: 1,
          fontSize: 12,
          fontWeight: 400,
          minWidth: 0
        }}
      >
        {collapsed ? getTaskShortLabel(task) : visibleTitle}
      </Typography.Text>
      {hasPendingApproval ? (
        <Tag
          data-testid={`task-pending-approval-${task.id}`}
          style={{
            background: "var(--app-color-fill-secondary)",
            borderColor: "var(--app-color-border)",
            color: "var(--app-color-text-secondary)",
            flexShrink: 0,
            fontSize: 11,
            lineHeight: "18px",
            marginInlineEnd: 0
          }}
        >
          待审批
        </Tag>
      ) : null}
      {task.status === "running" ? (
        <Spin data-testid={`task-running-${task.id}`} size="small" />
      ) : null}
      {hasUnreadCompletion ? (
        <span
          data-testid={`task-completed-unread-${task.id}`}
          style={{
            background: "var(--app-color-success)",
            borderRadius: "50%",
            flexShrink: 0,
            height: 6,
            width: 6
          }}
        />
      ) : null}
      {showActions ? (
        <Dropdown
          menu={{
            items: [
              {
                icon: <EditOutlined data-testid="task-rename-icon" />,
                key: "rename",
                label: "重命名",
                onClick: () => {
                  onRename(task, visibleTitle);
                }
              },
              {
                danger: true,
                icon: <DeleteOutlined data-testid="task-delete-icon" />,
                key: "delete",
                label: "删除",
                onClick: () => {
                  onDelete(task);
                }
              }
            ]
          }}
          onOpenChange={setActionsOpen}
          open={actionsOpen}
          trigger={["hover", "click"]}
        >
          <Button
            aria-label={`任务操作 ${visibleTitle}`}
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

function getTaskShortLabel(task: WorkspaceTaskSummary): string {
  return getTaskVisibleTitle(task)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getTaskVisibleTitle(task: WorkspaceTaskSummary): string {
  return task.title.trim() || task.initialUserMessage;
}
