import { useState } from "react";
import {
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { App, Button, Dropdown, Input, Modal, Typography } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { deleteTask, deleteWorkspace, renameTask } from "../workspace-nav-api";
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
    removeTask,
    removeWorkspace,
    setActiveTaskId,
    setActiveWorkspaceId,
    startNewConversation,
    updateTaskTitle
  } = useAppWorkspace();
  const [editingTask, setEditingTask] = useState<WorkspaceTaskSummary | null>(
    null
  );
  const [editingTitle, setEditingTitle] = useState("");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [taskActionsOpenId, setTaskActionsOpenId] = useState<string | null>(
    null
  );
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

  const confirmDeleteTask = (task: WorkspaceTaskSummary) => {
    modal.confirm({
      cancelText: "取消",
      content: "将删除此任务及其对应的对话记录。",
      okButtonProps: { danger: true },
      okText: "确认删除",
      onOk: async () => {
        try {
          await deleteTask(apiBaseUrl, task.id);
          removeTask(task.id);
        } catch (error) {
          void message.error(
            error instanceof Error ? error.message : "删除任务失败"
          );
        }
      },
      title: `删除任务 ${getTaskVisibleTitle(task)}？`
    });
  };

  const submitRenameTask = async () => {
    if (!editingTask) {
      return;
    }

    const title = editingTitle.trim();
    if (!title) {
      void message.error("任务名称不能为空");
      return;
    }

    try {
      const result = await renameTask(apiBaseUrl, editingTask.id, title);
      updateTaskTitle(result.id, result.title);
      setEditingTask(null);
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "重命名任务失败"
      );
    }
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
        const visibleTitle = getTaskVisibleTitle(task);
        const showTaskActions =
          !collapsed &&
          (hoveredTaskId === task.id || taskActionsOpenId === task.id);

        return (
          <div
            data-testid={`workspace-task-${task.id}`}
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
              alignItems: "center",
              background:
                isActiveTask || hoveredTaskId === task.id
                  ? "var(--app-color-fill-secondary)"
                  : undefined,
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
              ellipsis
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: 400,
                minWidth: 0
              }}
            >
              {collapsed ? getTaskShortLabel(task) : visibleTitle}
            </Typography.Text>
            {showTaskActions ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      icon: <EditOutlined data-testid="task-rename-icon" />,
                      key: "rename",
                      label: "重命名",
                      onClick: () => {
                        setEditingTask(task);
                        setEditingTitle(visibleTitle);
                      }
                    },
                    {
                      danger: true,
                      icon: <DeleteOutlined data-testid="task-delete-icon" />,
                      key: "delete",
                      label: "删除",
                      onClick: () => {
                        confirmDeleteTask(task);
                      }
                    }
                  ]
                }}
                onOpenChange={(open) => {
                  setTaskActionsOpenId(open ? task.id : null);
                }}
                open={taskActionsOpenId === task.id}
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
      })}
      <Modal
        cancelText="取消"
        okText="确定"
        onCancel={() => {
          setEditingTask(null);
        }}
        onOk={() => void submitRenameTask()}
        open={Boolean(editingTask)}
        title="重命名任务"
      >
        <Input
          aria-label="任务名称"
          autoFocus
          onChange={(event) => {
            setEditingTitle(event.target.value);
          }}
          onPressEnter={() => void submitRenameTask()}
          value={editingTitle}
        />
      </Modal>
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
