import { useEffect, useMemo, useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Flex, Input, Modal, Spin, Typography } from "antd";

import {
  CustomModelProviderModal,
  type CustomModelProviderFormValues
} from "./custom-model-provider-modal";
import { ModelProviderCard } from "./model-provider-card";

interface ModelProvidersViewProps {
  apiBaseUrl: string;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export interface ModelProviderSummary {
  baseUrl?: string;
  hasApiKey: boolean;
  id: string;
  modelCount: number;
  source: "builtin" | "custom";
}

interface CustomProviderModalState {
  initialValues?: CustomModelProviderFormValues;
  mode: "create" | "edit";
  open: boolean;
  providerId?: string;
}

type LoadState =
  | { status: "idle" | "loading" }
  | { providers: ModelProviderSummary[]; status: "success" }
  | { message: string; status: "error" };

export function ModelProvidersView({ apiBaseUrl }: ModelProvidersViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [customProviderModalState, setCustomProviderModalState] =
    useState<CustomProviderModalState>({
      mode: "create",
      open: false
    });
  const [hoveredProviderKey, setHoveredProviderKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isSavingCustomProvider, setIsSavingCustomProvider] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadProviders = async () => {
      setLoadState({ status: "loading" });

      try {
        const providers = await fetchModelProviders(apiBaseUrl);

        if (!isActive) {
          return;
        }

        setLoadState({
          providers,
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
    ];
  }, [loadState]);

  const refreshProviders = async () => {
    setLoadState({ status: "loading" });

    try {
      const providers = await fetchModelProviders(apiBaseUrl);

      setLoadState({
        providers,
        status: "success"
      });
    } catch (error) {
      setLoadState({
        message:
          error instanceof Error
            ? error.message
            : "Failed to load model providers",
        status: "error"
      });
    }
  };

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

  const submitCustomProvider = async (
    values: CustomModelProviderFormValues
  ) => {
    setIsSavingCustomProvider(true);

    try {
      const { mode, providerId } = customProviderModalState;
      const url =
        mode === "create"
          ? createCustomModelProviderUrl(apiBaseUrl)
          : createUpdateCustomModelProviderUrl(apiBaseUrl, providerId ?? "");
      const method = mode === "create" ? "POST" : "PUT";
      const response = await fetch(url, {
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json"
        },
        method
      });

      if (!response.ok) {
        throw new Error(
          mode === "create"
            ? "Failed to create custom provider"
            : "Failed to update custom provider"
        );
      }

      setCustomProviderModalState({
        mode: "create",
        open: false
      });
      await refreshProviders();
    } finally {
      setIsSavingCustomProvider(false);
    }
  };

  const deleteCustomProvider = async (providerId: string) => {
    const response = await fetch(
      createUpdateCustomModelProviderUrl(apiBaseUrl, providerId),
      {
        method: "DELETE"
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete custom provider");
    }

    await refreshProviders();
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
        <Empty
          description="暂无模型提供商"
          image={<ModelProvidersEmptyImage />}
          style={{ color: "var(--app-color-text)" }}
        />
      ) : null}

      {loadState.status === "success" ? (
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
                    onClick={() => {
                      setCustomProviderModalState({
                        mode: "create",
                        open: true
                      });
                    }}
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
                        onDeleteProvider={(nextProviderId) => {
                          void deleteCustomProvider(nextProviderId);
                        }}
                        onEditApiKey={(nextProviderId) => {
                          setEditingProviderId(nextProviderId);
                          setApiKeyInput("");
                        }}
                        onEditProvider={(nextProvider) => {
                          setCustomProviderModalState({
                            initialValues: {
                              baseUrl: nextProvider.baseUrl ?? "",
                              provider: nextProvider.id
                            },
                            mode: "edit",
                            open: true,
                            providerId: nextProvider.id
                          });
                        }}
                        onMouseEnter={() => {
                          setHoveredProviderKey(providerKey);
                        }}
                        onMouseLeave={() => {
                          setHoveredProviderKey((currentKey) =>
                            currentKey === providerKey ? null : currentKey
                          );
                        }}
                        provider={provider}
                      />
                    );
                  })}
                </Flex>
              )}
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
      <CustomModelProviderModal
        initialValues={customProviderModalState.initialValues}
        isSubmitting={isSavingCustomProvider}
        mode={customProviderModalState.mode}
        onCancel={() => {
          setCustomProviderModalState({
            mode: "create",
            open: false
          });
        }}
        onSubmit={submitCustomProvider}
        open={customProviderModalState.open}
      />
    </Flex>
  );
}

async function fetchModelProviders(
  apiBaseUrl: string
): Promise<ModelProviderSummary[]> {
  const response = await fetch(createModelProvidersUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load model providers");
  }

  const payload = (await response.json()) as ApiResponse<ModelProviderSummary[]>;

  return sortProviders(payload.data);
}

function createModelProvidersUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/model-providers`;
}

function createCustomModelProviderUrl(apiBaseUrl: string): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/custom`;
}

function createProviderApiKeyUrl(apiBaseUrl: string, providerId: string): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/${providerId}/api-key`;
}

function createUpdateCustomModelProviderUrl(
  apiBaseUrl: string,
  providerId: string
): string {
  return `${createCustomModelProviderUrl(apiBaseUrl)}/${providerId}`;
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

function ModelProvidersEmptyImage() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="72"
      viewBox="0 0 72 72"
      width="72"
    >
      <rect
        height="40"
        rx="10"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="2"
        width="40"
        x="16"
        y="16"
      />
      <path
        d="M26 32h20M26 40h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity="0.88"
        strokeWidth="2.5"
      />
      <circle cx="48" cy="50" fill="currentColor" fillOpacity="0.14" r="12" />
      <path
        d="M48 45v6M45 48h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.5"
      />
    </svg>
  );
}
