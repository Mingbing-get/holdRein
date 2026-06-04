import { useEffect } from "react";
import { Form, Input, Modal, Typography } from "antd";

export interface CustomModelProviderFormValues {
  baseUrl: string;
  provider: string;
}

interface CustomModelProviderModalProps {
  initialValues: CustomModelProviderFormValues | undefined;
  isSubmitting: boolean;
  mode: "create" | "edit";
  onCancel: () => void;
  onSubmit: (values: CustomModelProviderFormValues) => void | Promise<void>;
  open: boolean;
}

export function CustomModelProviderModal({
  initialValues,
  isSubmitting,
  mode,
  onCancel,
  onSubmit,
  open
}: CustomModelProviderModalProps) {
  const [form] = Form.useForm<CustomModelProviderFormValues>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      baseUrl: initialValues?.baseUrl ?? "",
      provider: initialValues?.provider ?? ""
    });
  }, [form, initialValues, open]);

  return (
    <Modal
      cancelText="取消"
      destroyOnHidden
      forceRender
      okButtonProps={{
        loading: isSubmitting
      }}
      okText={mode === "create" ? "创建" : "保存"}
      onCancel={onCancel}
      onOk={() => {
        void form.submit();
      }}
      open={open}
      title={mode === "create" ? "添加提供商" : "编辑提供商"}
    >
      <Form<CustomModelProviderFormValues>
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void onSubmit({
            baseUrl: values.baseUrl.trim(),
            provider: values.provider.trim()
          });
        }}
      >
        <Typography.Text style={{ marginBottom: 12 }} type="secondary">
          {mode === "create"
            ? "填写提供商标识和 Base URL 以创建自定义提供商。"
            : "更新提供商标识和 Base URL。"}
        </Typography.Text>
        <Form.Item
          label="提供商标识"
          name="provider"
          rules={[
            { required: true, message: "请输入提供商标识" },
            {
              pattern: /^[a-z0-9-]+$/u,
              message: "仅支持小写字母、数字和短横线"
            }
          ]}
        >
          <Input aria-label="提供商标识" placeholder="例如 acme-ai" />
        </Form.Item>
        <Form.Item
          label="Base URL"
          name="baseUrl"
          rules={[
            { required: true, message: "请输入 Base URL" },
            { type: "url", message: "请输入有效的 URL" }
          ]}
        >
          <Input aria-label="Base URL" placeholder="https://api.example.com/v1" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
