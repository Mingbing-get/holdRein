import {
  App,
  Button,
  Empty,
  Flex,
  Popconfirm,
  Table,
  Tag,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTasks,
  setScheduledTaskEnabled,
  updateScheduledTask
} from "./scheduled-tasks-api";
import { ScheduledTaskEditModal } from "./scheduled-task-edit-modal";
import type { ScheduledTask, ScheduledTaskInput } from "./scheduled-tasks-types";

interface ScheduledTasksViewProps {
  apiBaseUrl: string;
  workspacePath?: string;
}

export function ScheduledTasksView({
  apiBaseUrl,
  workspacePath
}: ScheduledTasksViewProps) {
  const { message } = App.useApp();
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);

  const refreshTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      setTasks(await fetchScheduledTasks(apiBaseUrl, workspacePath));
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "加载定时任务失败"
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, message, workspacePath]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  const closeEditor = () => {
    setEditingTask(null);
    setIsEditorOpen(false);
  };

  const submitTask = async (input: ScheduledTaskInput) => {
    setIsSubmitting(true);
    try {
      if (editingTask) {
        await updateScheduledTask(apiBaseUrl, editingTask.id, input);
      } else {
        await createScheduledTask(apiBaseUrl, input);
      }
      closeEditor();
      await refreshTasks();
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "保存定时任务失败"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTask = useCallback(async (task: ScheduledTask) => {
    try {
      await setScheduledTaskEnabled(apiBaseUrl, task.id, !task.enabled);
      await refreshTasks();
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "更新定时任务状态失败"
      );
    }
  }, [apiBaseUrl, message, refreshTasks]);

  const removeTask = useCallback(async (task: ScheduledTask) => {
    try {
      await deleteScheduledTask(apiBaseUrl, task.id);
      await refreshTasks();
    } catch (error) {
      void message.error(
        error instanceof Error ? error.message : "删除定时任务失败"
      );
    }
  }, [apiBaseUrl, message, refreshTasks]);

  const columns = useMemo<ColumnsType<ScheduledTask>>(
    () => [
      {
        dataIndex: "name",
        fixed: "left",
        title: "名称",
        width: 180
      },
      {
        dataIndex: "enabled",
        render: (enabled: boolean) => (
          <Tag color={enabled ? "success" : "default"}>
            {enabled ? "启用" : "禁用"}
          </Tag>
        ),
        title: "状态",
        width: 90
      },
      {
        dataIndex: "workspacePath",
        ellipsis: true,
        title: "Workspace",
        width: 260
      },
      {
        dataIndex: "modelId",
        render: (_value, task) => `${task.provider}/${task.modelId}`,
        title: "模型",
        width: 180
      },
      {
        dataIndex: "thinkingLevel",
        title: "思考",
        width: 90
      },
      {
        dataIndex: "cronExpression",
        title: "Cron",
        width: 140
      },
      {
        dataIndex: "allowConcurrentRuns",
        render: (allowConcurrentRuns: boolean) =>
          allowConcurrentRuns ? "允许" : "不允许",
        title: "并发",
        width: 90
      },
      {
        dataIndex: "nextRunAt",
        render: (value: string | null) => formatDateTime(value),
        title: "下次运行",
        width: 170
      },
      {
        dataIndex: "lastRunAt",
        render: (value: string | null) => formatDateTime(value),
        title: "上次运行",
        width: 170
      },
      {
        fixed: "right",
        render: (_value, task) => (
          <Flex gap={4}>
            <Button
              aria-label={`编辑 ${task.name}`}
              icon={<EditOutlined />}
              onClick={() => {
                setEditingTask(task);
                setIsEditorOpen(true);
              }}
              size="small"
              type="text"
            />
            <Popconfirm
              cancelText="取消"
              okText={task.enabled ? "确认禁用" : "确认启用"}
              onConfirm={() => void toggleTask(task)}
              title={`确认${task.enabled ? "禁用" : "启用"} ${task.name}？`}
            >
              <Button
                aria-label={`${task.enabled ? "禁用" : "启用"} ${task.name}`}
                icon={<StopOutlined />}
                size="small"
                type="text"
              />
            </Popconfirm>
            <Popconfirm
              cancelText="取消"
              okButtonProps={{ danger: true }}
              okText="确认删除"
              onConfirm={() => void removeTask(task)}
              title={`确认删除 ${task.name}？`}
            >
              <Button
                aria-label={`删除 ${task.name}`}
                danger
                icon={<DeleteOutlined />}
                size="small"
                type="text"
              />
            </Popconfirm>
          </Flex>
        ),
        title: "操作",
        width: 130
      }
    ],
    [removeTask, toggleTask]
  );

  return (
    <Flex gap={12} style={{ minHeight: 0 }} vertical>
      <Flex align="center" justify="space-between">
        <Flex gap={4} vertical>
          <Typography.Title level={4} style={{ margin: 0 }}>
            定时任务
          </Typography.Title>
          <Typography.Text type="secondary">
            {workspacePath ? `Workspace: ${workspacePath}` : "全部 workspace"}
          </Typography.Text>
        </Flex>
        <Button
          aria-label="新增定时任务"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingTask(null);
            setIsEditorOpen(true);
          }}
          type="primary"
        >
          新增定时任务
        </Button>
      </Flex>
      <Table<ScheduledTask>
        bordered
        columns={columns}
        dataSource={tasks}
        loading={isLoading}
        locale={{ emptyText: <Empty description="还没有定时任务。" /> }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1500 }}
        size="small"
        style={{
          background: "var(--app-color-bg-container)",
          borderColor: "var(--app-color-border-secondary)"
        }}
      />
      <ScheduledTaskEditModal
        apiBaseUrl={apiBaseUrl}
        isSubmitting={isSubmitting}
        onCancel={closeEditor}
        onSubmit={(input) => void submitTask(input)}
        open={isEditorOpen}
        task={editingTask}
        {...(workspacePath === undefined ? {} : { initialWorkspacePath: workspacePath })}
      />
    </Flex>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
