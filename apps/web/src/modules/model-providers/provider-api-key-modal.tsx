import { Flex, Input, Modal, Typography } from "antd";

interface ProviderApiKeyModalProps {
  isSubmitting: boolean;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  open: boolean;
  providerId: string | null;
  value: string;
}

export function ProviderApiKeyModal({
  isSubmitting,
  onCancel,
  onChange,
  onSubmit,
  open,
  providerId,
  value
}: ProviderApiKeyModalProps) {
  return (
    <Modal
      cancelText="取消"
      okButtonProps={{
        loading: isSubmitting
      }}
      okText="提交"
      onCancel={onCancel}
      onOk={() => {
        void onSubmit();
      }}
      open={open}
      title="配置 API Key"
    >
      <Flex gap={10} vertical>
        <Typography.Text type="secondary">
          {providerId ? `为 ${providerId} 配置 API Key。` : ""}
        </Typography.Text>
        <Input
          aria-label="API Key"
          onChange={(event) => {
            onChange(event.target.value);
          }}
          placeholder="输入 API Key"
          value={value}
        />
      </Flex>
    </Modal>
  );
}
