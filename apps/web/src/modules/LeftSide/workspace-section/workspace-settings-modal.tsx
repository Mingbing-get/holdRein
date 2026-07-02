import { useEffect, useMemo } from "react";
import { Form, Modal, Select, Segmented, Spin, Tag, Typography } from "antd";

import type {
  UpdateWorkspaceSettingRequest,
  WorkspaceSettingResponse
} from "../workspace-nav-types";

type CapabilityMode = "global" | "specified";

interface WorkspaceSettingsFormValues {
  pluginMode: CapabilityMode;
  plugins: string[];
  skillMode: CapabilityMode;
  skills: string[];
}

export interface WorkspaceSettingsModalProps {
  isLoading: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (request: UpdateWorkspaceSettingRequest) => void | Promise<void>;
  open: boolean;
  setting: WorkspaceSettingResponse | null;
  workspaceName: string;
}

const MODE_OPTIONS: { label: string; value: CapabilityMode }[] = [
  { label: "所有", value: "global" },
  { label: "指定", value: "specified" }
];

export function WorkspaceSettingsModal({
  isLoading,
  isSubmitting,
  onCancel,
  onSubmit,
  open,
  setting,
  workspaceName
}: WorkspaceSettingsModalProps) {
  const [form] = Form.useForm<WorkspaceSettingsFormValues>();
  const pluginMode = Form.useWatch("pluginMode", form);
  const skillMode = Form.useWatch("skillMode", form);
  const pluginOptions = useMemo(
    () =>
      (setting?.pluginOptions ?? []).map((plugin) => ({
        label: plugin.name,
        value: plugin.id
      })),
    [setting?.pluginOptions]
  );
  const skillOptions = useMemo(
    () =>
      (setting?.skillOptions ?? []).map((skill) => ({
        label: (
          <span style={{ alignItems: "center", display: "inline-flex", gap: 6 }}>
            {skill.name}
            <Tag>{skill.source === "workspace" ? "workspace" : "global"}</Tag>
          </span>
        ),
        title: skill.name,
        value: skill.id
      })),
    [setting?.skillOptions]
  );

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      pluginMode: setting?.setting.activePlugins ? "specified" : "global",
      plugins: setting?.setting.activePlugins ?? [],
      skillMode: setting?.setting.activeSkills ? "specified" : "global",
      skills: setting?.setting.activeSkills ?? []
    });
  }, [form, open, setting]);

  return (
    <Modal
      cancelText="取消"
      destroyOnHidden
      forceRender
      okButtonProps={{
        disabled: isLoading,
        loading: isSubmitting
      }}
      okText="提交"
      onCancel={onCancel}
      onOk={() => {
        void form.submit();
      }}
      open={open}
      title="Workspace 配置"
      width={640}
    >
      {isLoading ? (
        <Spin description="正在加载配置..." style={{ width: "100%" }} />
      ) : (
        <Form<WorkspaceSettingsFormValues>
          form={form}
          layout="vertical"
          onFinish={(values) => {
            void onSubmit({
              activePlugins:
                values.pluginMode === "global" ? null : values.plugins,
              activeSkills: values.skillMode === "global" ? null : values.skills
            });
          }}
        >
          <Typography.Text type="secondary">
            {workspaceName}
          </Typography.Text>
          <Form.Item label="插件策略" name="pluginMode">
            <Segmented block options={MODE_OPTIONS} />
          </Form.Item>
          {pluginMode === "specified" ? (
            <Form.Item label="可用插件" name="plugins">
              <Select
                aria-label="可用插件"
                mode="multiple"
                options={pluginOptions}
                placeholder="选择插件"
              />
            </Form.Item>
          ) : null}
          <Form.Item label="技能策略" name="skillMode">
            <Segmented
              block
              options={[
                { label: "所有", value: "global" },
                { label: "指定", value: "specified" }
              ]}
            />
          </Form.Item>
          {skillMode === "specified" ? (
            <Form.Item label="可用技能" name="skills">
              <Select
                aria-label="可用技能"
                mode="multiple"
                optionLabelProp="title"
                options={skillOptions}
                placeholder="选择技能"
              />
            </Form.Item>
          ) : null}
        </Form>
      )}
    </Modal>
  );
}
