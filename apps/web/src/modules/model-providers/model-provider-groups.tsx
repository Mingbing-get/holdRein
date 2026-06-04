import type { Dispatch, SetStateAction } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty, Flex, Typography } from "antd";

import { ModelProviderCard } from "./model-provider-card";
import { ModelProvidersEmptyImage } from "./model-providers-empty-image";
import type { ModelProviderSummary } from "./model-provider-types";

interface ProviderGroup {
  providers: ModelProviderSummary[];
  source: "builtin" | "custom";
  title: string;
}

interface ModelProviderGroupsProps {
  groupedProviders: ProviderGroup[];
  hoveredProviderKey: string | null;
  onAddProvider: () => void;
  onDeleteProvider: (providerId: string) => void;
  onEditApiKey: (providerId: string) => void;
  onEditProvider: (provider: ModelProviderSummary) => void;
  onHoverChange: Dispatch<SetStateAction<string | null>>;
  onViewModels: (provider: ModelProviderSummary) => void;
}

export function ModelProviderGroups({
  groupedProviders,
  hoveredProviderKey,
  onAddProvider,
  onDeleteProvider,
  onEditApiKey,
  onEditProvider,
  onHoverChange,
  onViewModels
}: ModelProviderGroupsProps) {
  return (
    <Flex gap={18} vertical>
      {groupedProviders.map((group) => (
        <Flex gap={10} key={group.source} vertical>
          <Flex align="center" justify="space-between">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {group.title}
            </Typography.Title>
            {group.source === "custom" ? (
              <Button
                aria-label="添加提供商"
                icon={<PlusOutlined />}
                onClick={onAddProvider}
                type="default"
              >
                添加提供商
              </Button>
            ) : null}
          </Flex>
          {group.source === "custom" && group.providers.length === 0 ? (
            <Empty
              description="还没有自定义提供商，先添加一个吧。"
              image={<ModelProvidersEmptyImage />}
              style={{ color: "var(--app-color-text)" }}
            />
          ) : (
            <Flex gap={12} wrap>
              {group.providers.map((provider) => {
                const providerKey = `${provider.source}-${provider.id}`;

                return (
                  <ModelProviderCard
                    isHovered={hoveredProviderKey === providerKey}
                    key={providerKey}
                    onDeleteProvider={onDeleteProvider}
                    onEditApiKey={onEditApiKey}
                    onEditProvider={onEditProvider}
                    onMouseEnter={() => {
                      onHoverChange(providerKey);
                    }}
                    onMouseLeave={() => {
                      onHoverChange((currentKey) =>
                        currentKey === providerKey ? null : currentKey
                      );
                    }}
                    onViewModels={onViewModels}
                    provider={provider}
                  />
                );
              })}
            </Flex>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
