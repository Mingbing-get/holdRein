import { useState } from "react";
import { App, Input, Modal } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { deleteTask, deleteWorkspace, renameTask } from "../workspace-nav-api";
import type {
  WorkspaceSummary,
  WorkspaceTaskSummary
} from "../workspace-nav-types";
import { WorkspaceHeading } from "./workspace-heading";
import { getTaskVisibleTitle, WorkspaceTask } from "./workspace-task";

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
        <WorkspaceHeading
          collapsed={workspaceCollapsed}
          onDelete={confirmDeleteWorkspace}
          onStartNewConversation={() => {
            startNewConversation(workspace.id);
            openChatWorkspace();
          }}
          onToggleCollapsed={() => {
            setWorkspaceCollapsed((currentValue) => !currentValue);
          }}
          workspace={workspace}
        />
      ) : null}

      {(!workspaceCollapsed || collapsed) &&
        workspace.tasks.map((task) => (
          <WorkspaceTask
            collapsed={collapsed}
            isActive={isActiveWorkspace && task.id === activeTaskId}
            key={task.id}
            onDelete={confirmDeleteTask}
            onOpen={() => {
              setActiveWorkspaceId(workspace.id);
              setActiveTaskId(task.id);
              openChatWorkspace();
            }}
            onRename={(selectedTask, visibleTitle) => {
              setEditingTask(selectedTask);
              setEditingTitle(visibleTitle);
            }}
            task={task}
          />
        ))}
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
