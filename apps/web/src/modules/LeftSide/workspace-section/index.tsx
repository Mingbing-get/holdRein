import { useState } from "react";
import { App, Button, Input, Modal } from "antd";

import { useAppUi } from "../../../app/app-ui-context";
import { useAppWorkspace } from "../../../app/app-workspace-context";
import { useAgentTasks } from "../../agent-messages";
import {
  deleteTask,
  deleteWorkspace,
  fetchWorkspaceSetting,
  fetchWorkspaceTaskPage,
  renameTask,
  updateWorkspaceSetting
} from "../workspace-nav-api";
import type {
  UpdateWorkspaceSettingRequest,
  WorkspaceSummary,
  WorkspaceTaskSummary
} from "../workspace-nav-types";
import { WorkspaceHeading } from "./workspace-heading";
import { WorkspaceSettingsModal } from "./workspace-settings-modal";
import { getTaskVisibleTitle, WorkspaceTask } from "./workspace-task";

const WORKSPACE_TASK_PAGE_SIZE = 20;

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
  const { hasPendingApproval, hasUnreadCompletion } = useAgentTasks();
  const {
    openWorkspaceNavigation
  } = useAppUi();
  const {
    state: { activeTaskId, activeWorkspaceId, workspaceSettings },
    removeTask,
    removeWorkspace,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaceSetting,
    setWorkspaces,
    startNewConversation,
    updateTaskTitle
  } = useAppWorkspace();
  const [editingTask, setEditingTask] = useState<WorkspaceTaskSummary | null>(
    null
  );
  const [editingTitle, setEditingTitle] = useState("");
  const [isLoadingMoreTasks, setIsLoadingMoreTasks] = useState(false);
  const [isLoadingWorkspaceSetting, setIsLoadingWorkspaceSetting] =
    useState(false);
  const [isSubmittingWorkspaceSetting, setIsSubmittingWorkspaceSetting] =
    useState(false);
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false);
  const [workspaceSettingOpen, setWorkspaceSettingOpen] = useState(false);
  const workspaceSetting = workspaceSettings[workspace.id] ?? null;
  const isActiveWorkspace = workspace.id === activeWorkspaceId;
  const lastTask = workspace.tasks.at(-1);
  const canLoadMoreTasks =
    !collapsed && !workspaceCollapsed && workspace.hasMore && Boolean(lastTask);

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

  const loadMoreTasks = async () => {
    if (!lastTask || isLoadingMoreTasks) {
      return;
    }

    setIsLoadingMoreTasks(true);

    try {
      const result = await fetchWorkspaceTaskPage(
        apiBaseUrl,
        workspace.id,
        lastTask.lastContinuedAt,
        WORKSPACE_TASK_PAGE_SIZE
      );

      setWorkspaces((currentWorkspaces) =>
        currentWorkspaces.map((currentWorkspace) =>
          currentWorkspace.id === workspace.id
            ? {
                ...currentWorkspace,
                hasMore: result.hasMore,
                tasks: [...currentWorkspace.tasks, ...result.tasks]
              }
            : currentWorkspace
        )
      );
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "加载更多任务失败"
      );
    } finally {
      setIsLoadingMoreTasks(false);
    }
  };

  const openWorkspaceSettings = async () => {
    setWorkspaceSettingOpen(true);

    if (workspaceSetting) {
      return;
    }

    try {
      setIsLoadingWorkspaceSetting(true);
      setWorkspaceSetting(await fetchWorkspaceSetting(apiBaseUrl, workspace.id));
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "加载工作空间配置失败"
      );
    } finally {
      setIsLoadingWorkspaceSetting(false);
    }
  };

  const submitWorkspaceSettings = async (
    request: UpdateWorkspaceSettingRequest
  ) => {
    setIsSubmittingWorkspaceSetting(true);

    try {
      const result = await updateWorkspaceSetting(
        apiBaseUrl,
        workspace.id,
        request
      );
      setWorkspaceSetting(
        await fetchWorkspaceSetting(apiBaseUrl, result.workspaceId)
      );
      setWorkspaceSettingOpen(false);
      void message.success("Workspace 配置已保存");
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "保存工作空间配置失败"
      );
    } finally {
      setIsSubmittingWorkspaceSetting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {!collapsed ? (
        <WorkspaceHeading
          collapsed={workspaceCollapsed}
          onDelete={confirmDeleteWorkspace}
          onOpenSettings={() => void openWorkspaceSettings()}
          onStartNewConversation={() => {
            startNewConversation(workspace.id);
            openWorkspaceNavigation();
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
            hasPendingApproval={hasPendingApproval(task.id)}
            hasUnreadCompletion={hasUnreadCompletion(task.id)}
            isActive={isActiveWorkspace && task.id === activeTaskId}
            key={task.id}
            onDelete={confirmDeleteTask}
            onOpen={() => {
              setActiveWorkspaceId(workspace.id);
              setActiveTaskId(task.id);
              openWorkspaceNavigation();
            }}
            onRename={(selectedTask, visibleTitle) => {
              setEditingTask(selectedTask);
              setEditingTitle(visibleTitle);
            }}
            task={task}
          />
        ))}
      {canLoadMoreTasks ? (
        <Button
          block
          loading={isLoadingMoreTasks}
          onClick={() => void loadMoreTasks()}
          size="small"
          style={{
            color: "var(--app-color-text-tertiary)",
            fontSize: 12,
            height: 28,
            justifyContent: "flex-start",
            paddingLeft: 20
          }}
          type="text"
        >
          加载更多
        </Button>
      ) : null}
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
      <WorkspaceSettingsModal
        isLoading={isLoadingWorkspaceSetting}
        isSubmitting={isSubmittingWorkspaceSetting}
        onCancel={() => {
          setWorkspaceSettingOpen(false);
        }}
        onSubmit={(request) => void submitWorkspaceSettings(request)}
        open={workspaceSettingOpen}
        setting={workspaceSetting}
        workspaceName={workspace.name}
      />
    </div>
  );
}
