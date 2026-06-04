import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Popconfirm, Tag, Typography } from "antd";

import type { ModelSummary } from "./model-provider-types";

interface ProviderModelCardProps {
  canManage: boolean;
  model: ModelSummary;
  onDelete: (model: ModelSummary) => void;
  onEdit: (model: ModelSummary) => void;
}

export function ProviderModelCard({
  canManage,
  model,
  onDelete,
  onEdit
}: ProviderModelCardProps) {
  return (
    <Card
      size="small"
      style={{
        background: "var(--app-color-bg-container)",
        borderColor: "var(--app-color-border-secondary)"
      }}
    >
      <Flex gap={10} vertical>
        <Flex align="start" justify="space-between">
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {model.name}
            </Typography.Title>
            <Typography.Text type="secondary">{model.id}</Typography.Text>
          </div>
          {canManage ? (
            <Flex gap={4}>
              <Button
                aria-label={`编辑模型 ${model.id}`}
                icon={<EditOutlined />}
                onClick={() => {
                  onEdit(model);
                }}
                shape="circle"
                size="small"
                type="text"
              />
              <Popconfirm
                cancelText="取消"
                description="删除后该模型将不再出现在当前提供商中。"
                okButtonProps={{ danger: true }}
                okText="删除模型"
                onConfirm={() => {
                  onDelete(model);
                }}
                title={`确认删除模型 ${model.id} 吗？`}
              >
                <Button
                  aria-label={`删除模型 ${model.id}`}
                  icon={<DeleteOutlined />}
                  shape="circle"
                  size="small"
                  style={{ color: "var(--app-color-danger)" }}
                  type="text"
                />
              </Popconfirm>
            </Flex>
          ) : null}
        </Flex>
        <Flex gap={8} wrap>
          <Tag color="blue">{model.api}</Tag>
          <Tag>{`上下文 ${model.contextWindow}`}</Tag>
          <Tag>{`输出 ${model.maxTokens}`}</Tag>
          <Tag color={model.reasoning ? "gold" : "default"}>
            {model.reasoning ? "支持推理" : "无推理"}
          </Tag>
        </Flex>
        <Typography.Text>{`支持输入: ${model.input.join(", ")}`}</Typography.Text>
      </Flex>
    </Card>
  );
}
