import { useEffect, useMemo, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Spin,
  Switch,
  Typography
} from "antd";

import { ProviderModelCard } from "./provider-model-card";
import type { ModelProviderSummary, ModelSummary } from "./model-provider-types";

interface ProviderModelsModalProps {
  isLoading: boolean;
  isSubmitting: boolean;
  models: ModelSummary[];
  onClose: () => void;
  onCreate: (values: ProviderModelFormValues) => void | Promise<void>;
  onDelete: (model: ModelSummary) => void | Promise<void>;
  onUpdate: (modelId: string, values: ProviderModelFormValues) => void | Promise<void>;
  open: boolean;
  provider: ModelProviderSummary | null;
}

interface ModelFormState {
  mode: "create" | "edit";
  modelId?: string;
  open: boolean;
}

export interface ProviderModelFormValues {
  api: string;
  contextWindow: number;
  input: string[];
  maxTokens: number;
  modelId: string;
  name: string;
  reasoning: boolean;
}

interface ProviderModelFormDraftValues {
  api: string;
  contextWindow: number;
  input: string;
  maxTokens: number;
  modelId: string;
  name: string;
  reasoning: boolean;
}

export function ProviderModelsModal({
  isLoading,
  isSubmitting,
  models,
  onClose,
  onCreate,
  onDelete,
  onUpdate,
  open,
  provider
}: ProviderModelsModalProps) {
  const [form] = Form.useForm<ProviderModelFormDraftValues>();
  const [modelFormState, setModelFormState] = useState<ModelFormState>({
    mode: "create",
    open: false
  });
  const editingModel = useMemo(
    () => models.find((model) => model.id === modelFormState.modelId),
    [modelFormState.modelId, models]
  );
  const canManage = provider?.source === "custom";

  useEffect(() => {
    if (!open) {
      setModelFormState({
        mode: "create",
        open: false
      });
    }
  }, [open]);

  useEffect(() => {
    if (!modelFormState.open) {
      form.resetFields();
      return;
    }

    const currentModel = modelFormState.mode === "edit" ? editingModel : undefined;

    form.setFieldsValue({
      api: currentModel?.api ?? "responses",
      contextWindow: currentModel?.contextWindow ?? 32000,
      input: currentModel?.input.join(", ") ?? "text",
      maxTokens: currentModel?.maxTokens ?? 4096,
      modelId: currentModel?.id ?? "",
      name: currentModel?.name ?? "",
      reasoning: currentModel?.reasoning ?? false
    } as never);
  }, [editingModel, form, modelFormState]);

  return (
    <>
      <Modal
        cancelText="关闭"
        footer={null}
        onCancel={onClose}
        open={open}
        title={provider ? `${provider.id} 支持的模型` : "提供商模型"}
        width={860}
      >
        <Flex gap={16} vertical>
          <Flex align="center" justify="space-between">
            <Typography.Text type="secondary">
              {provider
                ? `共 ${models.length} 个模型${canManage ? "，支持直接维护自定义模型。" : "。"}`
                : ""}
            </Typography.Text>
            {canManage ? (
              <Button
                aria-label="添加模型"
                icon={<PlusOutlined />}
                onClick={() => {
                  setModelFormState({
                    mode: "create",
                    open: true
                  });
                }}
                type="primary"
              >
                添加模型
              </Button>
            ) : null}
          </Flex>
          {isLoading ? (
            <Flex align="center" justify="center" style={{ minHeight: 220 }}>
              <Spin description="正在加载模型..." size="large" />
            </Flex>
          ) : null}
          {!isLoading && models.length === 0 ? (
            <Empty description={canManage ? "还没有模型，先添加一个吧。" : "该提供商暂无模型。"} />
          ) : null}
          {!isLoading && models.length > 0 ? (
            <Flex gap={12} vertical>
              {models.map((model) => (
                <ProviderModelCard
                  canManage={canManage}
                  key={model.id}
                  model={model}
                  onDelete={onDelete}
                  onEdit={(nextModel) => {
                    setModelFormState({
                      mode: "edit",
                      modelId: nextModel.id,
                      open: true
                    });
                  }}
                />
              ))}
            </Flex>
          ) : null}
        </Flex>
      </Modal>
      <Modal
        cancelText="取消"
        okButtonProps={{ loading: isSubmitting }}
        okText={modelFormState.mode === "create" ? "创建模型" : "保存模型"}
        onCancel={() => {
          setModelFormState({
            mode: "create",
            open: false
          });
        }}
        onOk={() => {
          void form.submit();
        }}
        open={modelFormState.open}
        title={modelFormState.mode === "create" ? "添加模型" : "编辑模型"}
      >
        <Form<ProviderModelFormDraftValues>
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const normalizedValues: ProviderModelFormValues = {
              api: values.api,
              contextWindow: Number(values.contextWindow),
              input: values.input
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0),
              maxTokens: Number(values.maxTokens),
              modelId: values.modelId.trim(),
              name: values.name.trim(),
              reasoning: values.reasoning
            };

            if (modelFormState.mode === "create") {
              await onCreate(normalizedValues);
            } else if (modelFormState.modelId) {
              await onUpdate(modelFormState.modelId, normalizedValues);
            }

            setModelFormState({
              mode: "create",
              open: false
            });
          }}
        >
          <Form.Item
            label="模型 ID"
            name="modelId"
            rules={[{ required: true, message: "请输入模型 ID" }]}
          >
            <Input aria-label="模型 ID" disabled={modelFormState.mode === "edit"} />
          </Form.Item>
          <Form.Item
            label="模型名称"
            name="name"
            rules={[{ required: true, message: "请输入模型名称" }]}
          >
            <Input aria-label="模型名称" />
          </Form.Item>
          <Form.Item
            label="API 类型"
            name="api"
            rules={[{ required: true, message: "请输入 API 类型" }]}
          >
            <Input aria-label="API 类型" placeholder="responses 或 chat-completions" />
          </Form.Item>
          <Form.Item
            label="支持输入"
            name="input"
            rules={[{ required: true, message: "请输入支持输入类型" }]}
          >
            <Input aria-label="支持输入" placeholder="例如 text, image" />
          </Form.Item>
          <Form.Item
            label="上下文窗口"
            name="contextWindow"
            rules={[{ required: true, message: "请输入上下文窗口" }]}
          >
            <InputNumber aria-label="上下文窗口" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="最大输出 Tokens"
            name="maxTokens"
            rules={[{ required: true, message: "请输入最大输出 Tokens" }]}
          >
            <InputNumber aria-label="最大输出 Tokens" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="支持推理" name="reasoning" valuePropName="checked">
            <Switch aria-label="支持推理" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
