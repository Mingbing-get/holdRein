import { Button, Flex, Input, Typography } from "antd";

export interface CreateFolderDialogProps {
  creating: boolean;
  error: string | null;
  name: string;
  onCancel: () => void;
  onChangeName: (name: string) => void;
  onConfirm: () => void;
}

export function CreateFolderDialog({
  creating,
  error,
  name,
  onCancel,
  onChangeName,
  onConfirm
}: CreateFolderDialogProps) {
  return (
    <div className="file-selector__dialog-layer">
      <div
        aria-label="新建文件夹"
        aria-modal="true"
        className="file-selector__dialog"
        role="dialog"
      >
        <Typography.Title level={5}>新建文件夹</Typography.Title>
        <Flex gap={8} vertical>
          <Input
            aria-label="文件夹名称"
            autoFocus
            onChange={(event) => {
              onChangeName(event.target.value);
            }}
            placeholder="请输入文件夹名称"
            value={name}
            {...(error ? { status: "error" } : {})}
          />
          {error ? (
            <Typography.Text type="danger">{error}</Typography.Text>
          ) : null}
        </Flex>
        <Flex gap={8} justify="flex-end">
          <Button onClick={onCancel}>取消</Button>
          <Button
            aria-label="确定"
            disabled={name.trim().length === 0}
            loading={creating}
            onClick={onConfirm}
            type="primary"
          >
            确定
          </Button>
        </Flex>
      </div>
    </div>
  );
}
