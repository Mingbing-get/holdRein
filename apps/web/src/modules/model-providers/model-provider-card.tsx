import { DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Popconfirm, Typography } from "antd";

import type { ModelProviderSummary } from "./model-provider-types";

interface ModelProviderCardProps {
  isHovered: boolean;
  onDeleteProvider: (providerId: string) => void;
  onEditApiKey: (providerId: string) => void;
  onEditProvider: (provider: ModelProviderSummary) => void;
  onViewModels: (provider: ModelProviderSummary) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  provider: ModelProviderSummary;
}

export function ModelProviderCard({
  isHovered,
  onDeleteProvider,
  onEditApiKey,
  onEditProvider,
  onViewModels,
  onMouseEnter,
  onMouseLeave,
  provider
}: ModelProviderCardProps) {
  return (
    <Card
      data-testid="model-provider-card"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        background: "var(--app-color-bg-container)",
        borderColor: "var(--app-color-border-secondary)",
        boxShadow: isHovered
          ? "0 14px 30px var(--app-color-shadow)"
          : "0 8px 18px color-mix(in srgb, var(--app-color-shadow) 40%, transparent)",
        flex: "1 1 260px",
        minWidth: 260,
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        transition:
          "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
      }}
      styles={{
        body: {
          padding: 14
        }
      }}
    >
      <Flex gap={8} vertical>
        <Flex align="start" justify="space-between">
          <Typography.Title level={5} style={{ margin: 0 }}>
            {provider.id}
          </Typography.Title>
          {provider.source === "custom" ? (
            <Flex gap={4}>
              <Button
                aria-label={`Edit provider ${provider.id}`}
                icon={<EditOutlined />}
                onClick={() => {
                  onEditProvider(provider);
                }}
                shape="circle"
                size="small"
                type="text"
              />
              <Popconfirm
                cancelText="取消"
                description="删除后会同时移除该提供商的 API Key 和全部模型。"
                okButtonProps={{ danger: true }}
                okText="删除"
                onConfirm={() => {
                  onDeleteProvider(provider.id);
                }}
                title={`确认删除 ${provider.id} 吗？`}
              >
                <Button
                  aria-label={`Delete provider ${provider.id}`}
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
        {provider.source === "custom" && provider.baseUrl ? (
          <Typography.Text type="secondary">{provider.baseUrl}</Typography.Text>
        ) : null}
        <Flex align="center" gap={8}>
          <Typography.Text>{`模型数量 ${provider.modelCount}`}</Typography.Text>
          <Button
            aria-label={`查看 ${provider.id} 的模型`}
            icon={<EyeOutlined />}
            onClick={() => {
              onViewModels(provider);
            }}
            shape="circle"
            size="small"
            type="text"
          />
        </Flex>
        <Flex align="center" gap={6}>
          <Typography.Text>
            {provider.hasApiKey ? "已配置 API Key" : "未配置 API Key"}
          </Typography.Text>
          <Button
            aria-label={`Edit API key for ${provider.id}`}
            icon={<EditOutlined />}
            onClick={() => {
              onEditApiKey(provider.id);
            }}
            shape="circle"
            size="small"
            type="text"
          />
        </Flex>
      </Flex>
    </Card>
  );
}
