import { useState } from "react";
import {
  DeleteOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { App, Button, Dropdown, Typography } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { deleteWorkspace } from "../workspace-nav-api";
import type {
  WorkspaceSummary,
  WorkspaceTaskSummary
} from "../workspace-nav-types";

export interface WorkspaceSectionProps {
  apiBaseUrl: string;
  collapsed: boolean;
  workspace: WorkspaceSummary;
}

export function WorkspaceSection({
  apiBaseUrl,
  collapsed,
  workspace
}: WorkspaceSectionProps) {
  const { message, modal } = App.useApp();
  const {
    openChatWorkspace
  } = useAppUi();
  const {
    state: { activeTaskId, activeWorkspaceId },
    removeWorkspace,
    setActiveTaskId,
    setActiveWorkspaceId,
    startNewConversation
  } = useAppWorkspace();
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [workspaceActionsOpen, setWorkspaceActionsOpen] = useState(false);
  const [workspaceHeadingHovered, setWorkspaceHeadingHovered] = useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const isActiveWorkspace = workspace.id === activeWorkspaceId;

  const confirmDeleteWorkspace = () => {
    modal.confirm({
      cancelText: "取消",
      content: "将删除此工作空间下的全部任务和对话记录，但不会删除项目目录。",
      okButtonProps: { danger: true },
      okText: "确认删除",
      onOk: async () => {
        try {
          await deleteWorkspace(apiBaseUrl, workspace.id);
          removeWorkspace(workspace.id);
        } catch (error) {
          void message.error(
            error instanceof Error ? error.message : "删除工作空间失败"
          );
        }
      },
      title: `删除工作空间 ${workspace.name}？`
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {!collapsed ? (
        <div
          data-testid={`workspace-heading-${workspace.id}`}
          onMouseEnter={() => {
            setWorkspaceHeadingHovered(true);
          }}
          onMouseLeave={() => {
            setWorkspaceHeadingHovered(false);
          }}
          style={{
            alignItems: "center",
            display: "flex",
            minWidth: 0,
            height: 22
          }}
        >
          <button
            aria-expanded={!workspaceCollapsed}
            aria-label={`${workspaceCollapsed ? "展开" : "折叠"}工作空间 ${workspace.name}`}
            data-testid={`workspace-group-${workspace.id}`}
            onClick={() => {
              setWorkspaceCollapsed((currentValue) => !currentValue);
            }}
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
            {workspaceCollapsed ? (
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
          {workspaceHeadingHovered || workspaceActionsOpen ? (
            <Dropdown
              menu={{
                items: [
                  {
                    icon: (
                      <PlusOutlined data-testid="workspace-new-conversation-icon" />
                    ),
                    key: "new-conversation",
                    label: "新对话",
                    onClick: () => {
                      startNewConversation(workspace.id);
                      openChatWorkspace();
                    }
                  },
                  {
                    danger: true,
                    icon: (
                      <DeleteOutlined data-testid="workspace-delete-icon" />
                    ),
                    key: "delete",
                    label: "删除",
                    onClick: confirmDeleteWorkspace
                  }
                ]
              }}
              onOpenChange={setWorkspaceActionsOpen}
              open={workspaceActionsOpen}
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
      ) : null}

      {(!workspaceCollapsed || collapsed) && workspace.tasks.map((task) => {
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
            {collapsed ? getTaskShortLabel(task) : getTaskVisibleTitle(task)}
          </Typography.Text>
        );
      })}
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
