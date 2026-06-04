import { useEffect, useMemo, useState } from "react";
import { EditOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Empty, Flex, Input, Modal, Spin, Typography } from "antd";

interface ModelProvidersViewProps {
  apiBaseUrl: string;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export interface ModelProviderSummary {
  hasApiKey: boolean;
  id: string;
  modelCount: number;
  source: "builtin" | "custom";
}

type LoadState =
  | { status: "idle" | "loading" }
  | { providers: ModelProviderSummary[]; status: "success" }
  | { message: string; status: "error" };

export function ModelProvidersView({ apiBaseUrl }: ModelProvidersViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [hoveredProviderKey, setHoveredProviderKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadProviders = async () => {
      setLoadState({ status: "loading" });

      try {
        const response = await fetch(createModelProvidersUrl(apiBaseUrl));

        if (!response.ok) {
          throw new Error("Failed to load model providers");
        }

        const payload =
          (await response.json()) as ApiResponse<ModelProviderSummary[]>;

        if (!isActive) {
          return;
        }

        setLoadState({
          providers: sortProviders(payload.data),
          status: "success"
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadState({
          message:
            error instanceof Error
              ? error.message
              : "Failed to load model providers",
          status: "error"
        });
      }
    };

    void loadProviders();

    return () => {
      isActive = false;
    };
  }, [apiBaseUrl]);

  const groupedProviders = useMemo(() => {
    if (loadState.status !== "success") {
      return [];
    }

    return [
      {
        providers: loadState.providers.filter((provider) => provider.source === "custom"),
        source: "custom" as const,
        title: "自定义"
      },
      {
        providers: loadState.providers.filter((provider) => provider.source === "builtin"),
        source: "builtin" as const,
        title: "内置"
      }
    ].filter((group) => group.providers.length > 0);
  }, [loadState]);

  const submitApiKey = async () => {
    if (!editingProviderId || apiKeyInput.trim() === "") {
      return;
    }

    setIsSavingApiKey(true);

    try {
      const response = await fetch(
        createProviderApiKeyUrl(apiBaseUrl, editingProviderId),
        {
          body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
          headers: {
            "Content-Type": "application/json"
          },
          method: "PUT"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to store API key");
      }

      setLoadState((currentState) => {
        if (currentState.status !== "success") {
          return currentState;
        }

        return {
          providers: currentState.providers.map((provider) =>
            provider.id === editingProviderId
              ? { ...provider, hasApiKey: true }
              : provider
          ),
          status: "success"
        };
      });
      setEditingProviderId(null);
      setApiKeyInput("");
    } finally {
      setIsSavingApiKey(false);
    }
  };

  return (
    <Flex
      data-testid="model-providers-view"
      gap={14}
      vertical
      style={{ minHeight: "100%" }}
    >
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          模型配置
        </Typography.Title>
        <Typography.Text type="secondary">
          查看所有模型提供商，并区分自定义与内置来源。
        </Typography.Text>
      </div>

      {loadState.status === "loading" ? (
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin description="正在加载模型提供商..." size="large" />
        </Flex>
      ) : null}

      {loadState.status === "error" ? (
        <Alert
          description={loadState.message}
          message="模型提供商加载失败"
          showIcon
          type="error"
        />
      ) : null}

      {loadState.status === "success" && loadState.providers.length === 0 ? (
        <Empty description="暂无模型提供商" />
      ) : null}

      {loadState.status === "success" ? (
        <Flex gap={18} vertical>
          {groupedProviders.map((group) => (
            <Flex gap={10} key={group.source} vertical>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {group.title}
              </Typography.Title>
              <Flex gap={12} wrap>
                {group.providers.map((provider) => {
                  const providerKey = `${provider.source}-${provider.id}`;
                  const isHovered = hoveredProviderKey === providerKey;

                  return (
                    <Card
                      key={providerKey}
                      data-testid="model-provider-card"
                      onMouseEnter={() => {
                        setHoveredProviderKey(providerKey);
                      }}
                      onMouseLeave={() => {
                        setHoveredProviderKey((currentKey) =>
                          currentKey === providerKey ? null : currentKey
                        );
                      }}
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
                        <Typography.Title level={5} style={{ margin: 0 }}>
                          {provider.id}
                        </Typography.Title>
                        <Typography.Text>模型数量 {provider.modelCount}</Typography.Text>
                        <Flex align="center" gap={8} justify="space-between">
                          <Typography.Text>
                            {provider.hasApiKey ? "已配置 API Key" : "未配置 API Key"}
                          </Typography.Text>
                          <Button
                            aria-label={`Edit API key for ${provider.id}`}
                            icon={<EditOutlined />}
                            onClick={() => {
                              setEditingProviderId(provider.id);
                              setApiKeyInput("");
                            }}
                            shape="circle"
                            size="small"
                            type="text"
                          />
                        </Flex>
                      </Flex>
                    </Card>
                  );
                })}
              </Flex>
            </Flex>
          ))}
        </Flex>
      ) : null}

      <Modal
        cancelText="取消"
        okButtonProps={{
          loading: isSavingApiKey
        }}
        okText="提交"
        onCancel={() => {
          setEditingProviderId(null);
          setApiKeyInput("");
        }}
        onOk={() => {
          void submitApiKey();
        }}
        open={editingProviderId !== null}
        title="配置 API Key"
      >
        <Flex gap={10} vertical>
          <Typography.Text type="secondary">
            {editingProviderId ? `为 ${editingProviderId} 配置 API Key。` : ""}
          </Typography.Text>
          <Input
            aria-label="API Key"
            onChange={(event) => {
              setApiKeyInput(event.target.value);
            }}
            placeholder="输入 API Key"
            value={apiKeyInput}
          />
        </Flex>
      </Modal>
    </Flex>
  );
}

function createModelProvidersUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/model-providers`;
}

function createProviderApiKeyUrl(apiBaseUrl: string, providerId: string): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/${providerId}/api-key`;
}

function sortProviders(
  providers: ModelProviderSummary[]
): ModelProviderSummary[] {
  return [...providers].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "custom" ? -1 : 1;
    }

    return left.id.localeCompare(right.id);
  });
}
