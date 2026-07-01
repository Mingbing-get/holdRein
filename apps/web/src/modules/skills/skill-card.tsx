import { DeleteOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Popconfirm, Switch, Tag, Typography } from "antd";

import type { InstalledSkill } from "./skill-management-types";

interface SkillCardProps {
  loading: boolean;
  onToggle: (skill: InstalledSkill, enabled: boolean) => void;
  onUninstall: (skill: InstalledSkill) => void;
  skill: InstalledSkill;
}

export function SkillCard({
  loading,
  onToggle,
  onUninstall,
  skill
}: SkillCardProps) {
  const enabled = !skill.disabled;

  return (
    <Card
      data-testid={`skill-card-${skill.id}`}
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
              {skill.name}
            </Typography.Text>
            <Tag>{enabled ? "已启用" : "已禁用"}</Tag>
          </Flex>
          <Typography.Text
            style={{
              color: "var(--app-color-text-tertiary)",
              fontSize: 12
            }}
          >
            ID: {skill.id}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8}>
          <Switch
            aria-label={`${enabled ? "禁用" : "启用"} ${skill.name}`}
            checked={enabled}
            disabled={loading}
            onChange={(checked) => onToggle(skill, checked)}
            size="small"
          />
          <Popconfirm
            cancelText="取消"
            okButtonProps={{ danger: true }}
            okText="卸载"
            onConfirm={() => onUninstall(skill)}
            title={`卸载 ${skill.name}`}
          >
            <Button
              aria-label={`卸载 ${skill.name}`}
              danger
              disabled={loading}
              icon={<DeleteOutlined />}
              size="small"
              type="text"
            />
          </Popconfirm>
        </Flex>
      </Flex>
    </Card>
  );
}
