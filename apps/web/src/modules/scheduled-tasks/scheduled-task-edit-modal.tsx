import { Form, Input, Modal, Select, Switch } from "antd";
import { useEffect } from "react";

import { ModelSelector, type SelectedModel } from "../chat/model-selector";
import { THINKING_LEVEL_OPTIONS } from "../chat/sender/task-options";
import { WorkspaceSelector } from "../chat/workspace-selector";
import type { ScheduledTask, ScheduledTaskInput } from "./scheduled-tasks-types";

interface ScheduledTaskEditModalProps {
  apiBaseUrl: string;
  initialWorkspacePath?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (input: ScheduledTaskInput) => void | Promise<void>;
  open: boolean;
  task: ScheduledTask | null;
}

export function ScheduledTaskEditModal({
  apiBaseUrl,
  initialWorkspacePath,
  isSubmitting,
  onCancel,
  onSubmit,
  open,
  task
}: ScheduledTaskEditModalProps) {
  const [form] = Form.useForm<ScheduledTaskFormValues>();
  const modelId = Form.useWatch("modelId", form);
  const provider = Form.useWatch("provider", form);
  const workspaceLocked = Boolean(initialWorkspacePath || task);

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      allowConcurrentRuns: task?.allowConcurrentRuns ?? false,
      cronExpression: task?.cronExpression ?? "",
      modelId: task?.modelId ?? "",
      name: task?.name ?? "",
      prompt: task?.prompt ?? "",
      provider: task?.provider ?? "",
      thinkingLevel: task?.thinkingLevel ?? "medium",
      workspacePath: task?.workspacePath ?? initialWorkspacePath ?? ""
    });
  }, [form, initialWorkspacePath, open, task]);

  const selectedModel: SelectedModel | undefined =
    provider && modelId ? { modelId, providerId: provider } : undefined;

  return (
    <Modal
      cancelText="取消"
      destroyOnHidden
      okButtonProps={{ loading: isSubmitting }}
      okText="保存定时任务"
      onCancel={onCancel}
      onOk={() => void form.submit()}
      open={open}
      title={task ? "编辑定时任务" : "新增定时任务"}
      width={720}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void onSubmit({
            allowConcurrentRuns: values.allowConcurrentRuns,
            cronExpression: values.cronExpression.trim(),
            modelId: values.modelId,
            name: values.name.trim(),
            prompt: values.prompt.trim(),
            provider: values.provider,
            thinkingLevel: values.thinkingLevel,
            timezone: getUserTimezone(),
            workspacePath: values.workspacePath
          });
        }}
      >
        <Form.Item
          label="Workspace Path"
          name="workspacePath"
          rules={[{ message: "请选择 workspace", required: true }]}
        >
          <WorkspaceSelector
            ariaLabel="Workspace Path"
            apiBaseUrl={apiBaseUrl}
            className="scheduled-task-form-control"
            disabled={workspaceLocked}
            style={{ width: "100%" }}
            variant="outlined"
          />
        </Form.Item>
        <Form.Item label="模型" required>
          <ModelSelector
            apiBaseUrl={apiBaseUrl}
            className="scheduled-task-form-control"
            onChange={(value) => {
              form.setFieldsValue({
                modelId: value.modelId,
                provider: value.providerId
              });
            }}
            style={{ width: "100%" }}
            value={selectedModel}
            variant="outlined"
          />
        </Form.Item>
        <Form.Item hidden name="modelId" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item hidden name="provider" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="任务名称"
          name="name"
          rules={[{ message: "请输入任务名称", required: true }]}
        >
          <Input autoComplete="off" />
        </Form.Item>
        <Form.Item
          label="任务提示词"
          name="prompt"
          rules={[{ message: "请输入任务提示词", required: true }]}
        >
          <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} />
        </Form.Item>
        <Form.Item
          label="Cron 表达式"
          name="cronExpression"
          rules={[{ message: "请输入 Cron 表达式", required: true }]}
        >
          <Input autoComplete="off" placeholder="*/5 * * * *" />
        </Form.Item>
        <Form.Item label="思考级别" name="thinkingLevel">
          <Select options={THINKING_LEVEL_OPTIONS} />
        </Form.Item>
        <Form.Item
          label="允许并发运行"
          name="allowConcurrentRuns"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}

interface ScheduledTaskFormValues {
  allowConcurrentRuns: boolean;
  cronExpression: string;
  modelId: string;
  name: string;
  prompt: string;
  provider: string;
  thinkingLevel: ScheduledTaskInput["thinkingLevel"];
  workspacePath: string;
}

function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}
