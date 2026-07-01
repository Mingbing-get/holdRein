import { FolderOpenOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Segmented } from "antd";
import { useEffect, useState } from "react";

import { FileSelector } from "../../components/fileSelector";
import "./plugin-install-modal.css";
import type {
  PluginInstallRequest,
  PluginInstallSourceType
} from "./plugin-management-types";

interface PluginInstallModalProps {
  apiBaseUrl: string;
  confirmLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: PluginInstallRequest) => void;
  open: boolean;
}

interface PluginInstallFormValues {
  source: string;
  sourceType: PluginInstallSourceType;
}

const SOURCE_TYPE_OPTIONS = [
  { label: "npm", value: "npm" },
  { label: "GitHub", value: "github" },
  { label: "本地", value: "local" }
] as const;

const NPM_PACKAGE_PATTERN =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const GITHUB_REPOSITORY_PATTERN =
  /^(?:https:\/\/github\.com\/[^/\s]+\/[^/\s]+?(?:(?:\.git)?\/?|\/tree\/[^/\s]+(?:\/[^/\s]+)+)|git@github\.com:[^/\s]+\/[^/\s]+?(?:\.git)?)$/u;

export function PluginInstallModal({
  apiBaseUrl,
  confirmLoading,
  onCancel,
  onSubmit,
  open
}: PluginInstallModalProps) {
  const [form] = Form.useForm<PluginInstallFormValues>();
  const [sourceType, setSourceType] = useState<PluginInstallSourceType>("npm");
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setSourceType("npm");
      form.setFieldsValue({ source: "", sourceType: "npm" });
    }
  }, [form, open]);

  return (
    <>
      <Modal
        cancelText="取消"
        confirmLoading={confirmLoading}
        destroyOnHidden
        okButtonProps={{ "aria-label": "确认安装插件" }}
        okText="安装"
        onCancel={onCancel}
        onOk={() => void form.submit()}
        open={open}
        title="安装插件"
      >
        <Form
          form={form}
          initialValues={{ sourceType: "npm" }}
          layout="vertical"
          onFinish={(values) => {
            onSubmit({
              source: values.source.trim(),
              sourceType: values.sourceType
            });
          }}
        >
          <Form.Item label="安装来源" name="sourceType">
            <Segmented
              block
              className="plugin-install-source-segmented"
              options={[...SOURCE_TYPE_OPTIONS]}
              onChange={(value) => {
                const nextSourceType = value as PluginInstallSourceType;
                setSourceType(nextSourceType);
                form.setFieldsValue({ source: "", sourceType: nextSourceType });
              }}
            />
          </Form.Item>
          {sourceType === "local" ? (
            <Form.Item
              label="本地插件文件夹"
              name="source"
              rules={[{ message: "请选择本地插件文件夹", required: true }]}
            >
              <Input
                onClick={() => setSelectorOpen(true)}
                readOnly
                suffix={
                  <Button
                    aria-label="选择文件夹"
                    htmlType="button"
                    icon={<FolderOpenOutlined />}
                    onClick={() => setSelectorOpen(true)}
                    size="small"
                    type="text"
                  />
                }
                placeholder="选择插件文件夹"
              />
            </Form.Item>
          ) : (
            <Form.Item
              label={sourceType === "npm" ? "npm 包名" : "GitHub 仓库地址"}
              name="source"
              rules={[
                {
                  message:
                    sourceType === "npm"
                      ? "请输入 npm 包名"
                      : "请输入 GitHub 仓库地址",
                  required: true
                },
                {
                  message:
                    sourceType === "npm"
                      ? "请输入有效的 npm 包名"
                      : "请输入有效的 GitHub 仓库地址",
                  validator: async (_, value: unknown) => {
                    if (typeof value !== "string") {
                      return;
                    }

                    if (isValidSource(sourceType, value)) {
                      return;
                    }

                    throw new Error("请输入有效的插件来源");
                  }
                }
              ]}
            >
              <Input
                autoFocus
                placeholder={
                  sourceType === "npm"
                    ? "@scope/hold-rein-plugin"
                    : "https://github.com/owner/hold-rein-plugin.git"
                }
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <FileSelector
        apiBaseUrl={apiBaseUrl}
        onCancel={() => setSelectorOpen(false)}
        onConfirm={(path) => {
          form.setFieldsValue({ source: path, sourceType: "local" });
          setSelectorOpen(false);
        }}
        open={selectorOpen}
        selectableTypes={["folder"]}
        title="选择本地插件文件夹"
      />
    </>
  );
}

function isValidSource(
  sourceType: PluginInstallSourceType,
  source: string
): boolean {
  const value = source.trim();

  if (sourceType === "npm") {
    return NPM_PACKAGE_PATTERN.test(value);
  }

  return GITHUB_REPOSITORY_PATTERN.test(value);
}
