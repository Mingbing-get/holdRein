import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined
} from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Space,
  Switch,
  Typography
} from "antd";
import { useEffect, useState } from "react";

import {
  deleteMcpServer,
  listMcpServers,
  saveMcpServer
} from "./mcp-settings-api";
import type {
  McpServerConfigRequest,
  McpServerConfigSummary,
  McpTransport
} from "./mcp-settings-types";

interface McpSettingsViewProps {
  readonly request: WebPlugin.RuntimeContext["request"];
}

interface McpSettingsFormValues {
  readonly args: string;
  readonly command: string;
  readonly enabled: boolean;
  readonly env: string;
  readonly headers: string;
  readonly id: string;
  readonly name: string;
  readonly transport: McpTransport;
  readonly url: string;
}

export function McpSettingsView({ request }: McpSettingsViewProps) {
  const [form] = Form.useForm<McpSettingsFormValues>();
  const [servers, setServers] = useState<McpServerConfigSummary[]>([]);
  const [editingServer, setEditingServer] =
    useState<McpServerConfigSummary | undefined>();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const transport = Form.useWatch("transport", form) ?? "stdio";

  useEffect(() => {
    void refreshServers();
  }, []);

  async function refreshServers(): Promise<void> {
    setLoading(true);
    try {
      const response = await listMcpServers(request);
      setServers(response.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(): Promise<void> {
    const values = await form.validateFields();
    const response = await saveMcpServer(
      request,
      values.id.trim(),
      toRequest(values)
    );
    setServers((current) => [
      ...current.filter((server) => server.id !== response.data.id),
      response.data
    ]);
    setEditingServer(undefined);
    setModalOpen(false);
  }

  async function handleDelete(serverId: string): Promise<void> {
    await deleteMcpServer(request, serverId);
    setServers((current) => current.filter((server) => server.id !== serverId));
  }

  function handleNew(): void {
    setEditingServer(undefined);
    form.setFieldsValue(toFormValues(undefined));
    setModalOpen(true);
  }

  function handleEdit(server: McpServerConfigSummary): void {
    setEditingServer(server);
    form.setFieldsValue(toFormValues(server));
    setModalOpen(true);
  }

  function handleCancel(): void {
    setEditingServer(undefined);
    setModalOpen(false);
  }

  return (
    <section
      data-testid="mcp-settings-view"
      style={{
        background: "var(--app-color-bg-container)",
        color: "var(--app-color-text)",
        minHeight: "100%",
        padding: 20
      }}
    >
      <Space orientation="vertical" size={18} style={{ display: "flex" }}>
        <Space
          align="center"
          style={{ justifyContent: "space-between", width: "100%" }}
        >
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              MCP 配置
            </Typography.Title>
            <Typography.Text type="secondary">
              管理当前插件接入的 MCP 服务。
            </Typography.Text>
          </div>
          <Button
            aria-label="New server"
            icon={<PlusOutlined />}
            onClick={handleNew}
            type="primary"
          >
            新增
          </Button>
        </Space>

        {servers.length === 0 ? (
          <div aria-busy={loading}>
            <Empty description="No MCP servers" />
          </div>
        ) : (
          <div
            aria-busy={loading}
            data-testid="mcp-server-grid"
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))"
            }}
          >
            {servers.map((server) => (
              <Card
                actions={[
                  <Button
                    aria-label={`Edit ${server.name}`}
                    icon={<EditOutlined />}
                    key="edit"
                    onClick={() => handleEdit(server)}
                    type="text"
                  >
                    编辑
                  </Button>,
                  <Popconfirm
                    cancelText="取消"
                    key="delete"
                    okButtonProps={{
                      "aria-label": `Confirm delete ${server.name}`
                    }}
                    okText="确认"
                    onConfirm={() => void handleDelete(server.id)}
                    title="确认删除 MCP 配置？"
                  >
                    <Button
                      aria-label={`Delete ${server.name}`}
                      danger
                      icon={<DeleteOutlined />}
                      type="text"
                    >
                      删除
                    </Button>
                  </Popconfirm>
                ]}
                key={server.id}
                style={{
                  background: "var(--app-color-bg-container)",
                  borderColor: "var(--app-color-border-secondary)",
                  borderRadius: 8
                }}
                title={
                  <Space orientation="vertical" size={2}>
                    <Typography.Text strong>{server.name}</Typography.Text>
                    <Typography.Text type="secondary">
                      {server.id}
                    </Typography.Text>
                  </Space>
                }
              >
                <Space
                  orientation="vertical"
                  size={10}
                  style={{ display: "flex" }}
                >
                  <Space style={{ justifyContent: "space-between" }}>
                    <Typography.Text type="secondary">Transport</Typography.Text>
                    <Typography.Text>{server.transport}</Typography.Text>
                  </Space>
                  <Space style={{ justifyContent: "space-between" }}>
                    <Typography.Text type="secondary">Status</Typography.Text>
                    <Typography.Text
                      style={{
                        color: server.enabled
                          ? "var(--app-color-success)"
                          : "var(--app-color-text-secondary)"
                      }}
                    >
                      {server.enabled ? "Enabled" : "Disabled"}
                    </Typography.Text>
                  </Space>
                  <Typography.Paragraph
                    ellipsis
                    style={{ marginBottom: 0 }}
                    type="secondary"
                  >
                    {server.transport === "stdio"
                      ? server.command
                      : server.url}
                  </Typography.Paragraph>
                </Space>
              </Card>
            ))}
          </div>
        )}

        <Modal
          destroyOnHidden
          footer={null}
          onCancel={handleCancel}
          open={modalOpen}
          title={editingServer ? "编辑 MCP 配置" : "新增 MCP 配置"}
        >
          <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
            <Space align="center" size={16}>
              <Form.Item label="Transport" name="transport">
                <Segmented
                  options={[
                    { label: "STDIO", value: "stdio" },
                    { label: "HTTP", value: "http" },
                    { label: "SSE", value: "sse" }
                  ]}
                />
              </Form.Item>
              <Form.Item label="Enabled" name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Space>

            <Form.Item label="Id" name="id" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Name" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            {transport === "stdio" ? (
              <>
                <Form.Item
                  label="Command"
                  name="command"
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="Args" name="args">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item label="URL" name="url" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Headers" name="headers">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </>
            )}

            <Form.Item label="Env" name="env">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Space>
              <Button
                icon={<SaveOutlined />}
                onClick={() => void handleSave()}
                type="primary"
              >
                Save
              </Button>
              <Button onClick={handleCancel}>Cancel</Button>
            </Space>
          </Form>
        </Modal>
      </Space>
    </section>
  );
}

function toFormValues(
  server: McpServerConfigSummary | undefined
): McpSettingsFormValues {
  return {
    args: server?.args.join("\n") ?? "",
    command: server?.command ?? "",
    enabled: server?.enabled ?? true,
    env: stringifyRecord(server?.env ?? {}),
    headers: stringifyRecord(server?.headers ?? {}),
    id: server?.id ?? "local",
    name: server?.name ?? "",
    transport: server?.transport ?? "stdio",
    url: server?.url ?? ""
  };
}

function toRequest(values: McpSettingsFormValues): McpServerConfigRequest {
  return withoutUndefined({
    args: splitLines(values.args ?? ""),
    command: values.command?.trim() || undefined,
    enabled: values.enabled,
    env: parseSecretRecord(values.env ?? ""),
    headers: parseStringRecord(values.headers ?? ""),
    name: values.name,
    transport: values.transport,
    url: values.url?.trim() || undefined
  }) as McpServerConfigRequest;
}

function stringifyRecord(record: Readonly<Record<string, string>>): string {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

function parseStringRecord(text: string): Record<string, string> {
  return Object.fromEntries(
    splitLines(text).map((line) => {
      const separator = line.indexOf("=");
      return separator === -1
        ? [line, ""]
        : [line.slice(0, separator), line.slice(separator + 1)];
    })
  );
}

function parseSecretRecord(text: string): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(parseStringRecord(text)).map(([key, value]) => [
      key,
      value === "********" ? null : value
    ])
  );
}

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined)
  ) as Partial<T>;
}
