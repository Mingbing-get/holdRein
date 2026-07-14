import {
  App,
  Button,
  Empty,
  Flex,
  Popconfirm,
  Switch,
  Table,
  Tooltip,
  Typography
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { describeCronExpression } from "../../components/cronExpressionInput";
import "./scheduled-tasks-view.css";
import { THINKING_LEVEL_OPTIONS } from "../chat/sender/task-options";
import { getWorkspaceLabelFromPath } from "../chat/workspace-selector";
import { fetchCachedProviderModels } from "../model-providers/model-provider-api";
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
  const [modelLabels, setModelLabels] = useState<Record<string, string>>({});
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

  useEffect(() => {
    let isCurrent = true;
    const providerIds = [...new Set(tasks.map((task) => task.provider))];

    void Promise.all(
      providerIds.map(async (providerId) => ({
        models: await fetchCachedProviderModels(apiBaseUrl, providerId).catch(
          () => []
        ),
        providerId
      }))
    ).then((providerModels) => {
      if (!isCurrent) return;

      setModelLabels(
        Object.fromEntries(
          providerModels.flatMap(({ models, providerId }) =>
            models.map((model) => [createModelKey(providerId, model.id), model.name])
          )
        )
      );
    });

    return () => {
      isCurrent = false;
    };
  }, [apiBaseUrl, tasks]);

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
        dataIndex: "workspacePath",
        ellipsis: true,
        render: (value: string) => (
          <Tooltip title={value}>{getWorkspaceLabelFromPath(value)}</Tooltip>
        ),
        title: "工作空间",
        width: 260
      },
      {
        dataIndex: "modelId",
        render: (_value, task) => formatModelName(task, modelLabels),
        title: "模型",
        width: 180
      },
      {
        dataIndex: "thinkingLevel",
        render: (value: ScheduledTask["thinkingLevel"]) =>
          formatThinkingLevel(value),
        title: "思考",
        width: 90
      },
      {
        dataIndex: "cronExpression",
        render: (value: string) => formatCronExpression(value),
        title: "执行周期",
        width: 220
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
        dataIndex: "enabled",
        fixed: "right",
        render: (_enabled: boolean, task) => (
          <Switch
            aria-label={`${task.enabled ? "禁用" : "启用"} ${task.name}`}
            checked={task.enabled}
            onChange={() => void toggleTask(task)}
            size="small"
          />
        ),
        title: "状态",
        width: 90
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
        width: 90
      }
    ],
    [modelLabels, removeTask, toggleTask]
  );

  return (
    <Flex gap={12} style={{ minHeight: 0 }} vertical>
      <Flex align="center" justify="space-between">
        <Typography.Title level={4} style={{ margin: 0 }}>
          定时任务
        </Typography.Title>
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
        className="scheduled-tasks-table"
        columns={columns}
        dataSource={tasks}
        loading={isLoading}
        locale={{ emptyText: <Empty description="还没有定时任务。" /> }}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1500 }}
        size="small"
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

function formatModelName(
  task: Pick<ScheduledTask, "modelId" | "provider">,
  modelLabels: Readonly<Record<string, string>>
): string {
  return (
    modelLabels[createModelKey(task.provider, task.modelId)] ??
    createModelKey(task.provider, task.modelId)
  );
}

function createModelKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

function formatThinkingLevel(value: ScheduledTask["thinkingLevel"]): string {
  return (
    THINKING_LEVEL_OPTIONS.find((option) => option.value === value)?.label ?? value
  );
}

function formatCronExpression(value: string): string {
  try {
    return describeCronExpression(value);
  } catch {
    return value;
  }
}
