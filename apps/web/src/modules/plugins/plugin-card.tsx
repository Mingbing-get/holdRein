import { Card, Flex, Switch, Tag, Typography } from "antd";

import type { InstalledPlugin } from "./plugin-management-types";

interface PluginCardProps {
  loading: boolean;
  onToggle: (plugin: InstalledPlugin, enabled: boolean) => void;
  plugin: InstalledPlugin;
}

export function PluginCard({ loading, onToggle, plugin }: PluginCardProps) {
  const enabled = plugin.disabled !== true;

  return (
    <Card
      data-testid={`plugin-card-${plugin.id}`}
      size="small"
      style={{
        borderColor: "var(--app-color-border-secondary)",
        borderRadius: 8
      }}
    >
      <Flex align="flex-start" gap={12} justify="space-between">
        <Flex gap={6} style={{ minWidth: 0 }} vertical>
          <Flex align="center" gap={8} wrap="wrap">
            <Typography.Text
              strong
              style={{
                color: "var(--app-color-text)",
                fontSize: 13
              }}
            >
              {plugin.name}
            </Typography.Text>
            <Tag>{enabled ? "已启用" : "已禁用"}</Tag>
          </Flex>
          <Typography.Text
            style={{
              color: "var(--app-color-text-secondary)",
              fontSize: 12
            }}
          >
            {plugin.packageName}
          </Typography.Text>
          <Typography.Text
            style={{
              color: "var(--app-color-text-tertiary)",
              fontSize: 12
            }}
          >
            版本: {plugin.version}
          </Typography.Text>
        </Flex>
        <Switch
          aria-label={`${enabled ? "禁用" : "启用"} ${plugin.name}`}
          checked={enabled}
          disabled={loading}
          onChange={(checked) => onToggle(plugin, checked)}
          size="small"
        />
      </Flex>
    </Card>
  );
}
