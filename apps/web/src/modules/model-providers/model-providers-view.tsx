import { useEffect, useMemo, useState } from "react";
import { Alert, Empty, Flex, Spin, Typography } from "antd";

import {
  createCustomModelProviderUrl,
  createProviderApiKeyUrl,
  createProviderModelUrl,
  createProviderModelsUrl,
  createUpdateCustomModelProviderUrl,
  fetchModelProviders,
  fetchProviderModels
} from "./model-provider-api";
import {
  CustomModelProviderModal,
  type CustomModelProviderFormValues
} from "./custom-model-provider-modal";
import { ModelProviderGroups } from "./model-provider-groups";
import { ModelProvidersEmptyImage } from "./model-providers-empty-image";
import { ProviderApiKeyModal } from "./provider-api-key-modal";
import { ProviderModelsModal, type ProviderModelFormValues } from "./provider-models-modal";
import type { ModelProviderSummary, ModelSummary } from "./model-provider-types";

interface ModelProvidersViewProps {
  apiBaseUrl: string;
}

interface CustomProviderModalState {
  initialValues?: CustomModelProviderFormValues;
  mode: "create" | "edit";
  open: boolean;
  providerId?: string;
}

interface ProviderModelsModalState {
  isLoading: boolean;
  isSubmitting: boolean;
  models: ModelSummary[];
  open: boolean;
  provider: ModelProviderSummary | null;
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
  const [providerModelsModalState, setProviderModelsModalState] =
    useState<ProviderModelsModalState>({
      isLoading: false,
      isSubmitting: false,
      models: [],
      open: false,
      provider: null
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

  const updateProviderModelCount = (providerId: string, modelCount: number) => {
    setLoadState((currentState) => {
      if (currentState.status !== "success") {
        return currentState;
      }
      return {
        providers: currentState.providers.map((provider) =>
          provider.id === providerId ? { ...provider, modelCount } : provider
        ),
        status: "success"
      };
    });
  };

  const refreshProviderModels = async (
    provider: ModelProviderSummary
  ): Promise<ModelSummary[]> => {
    setProviderModelsModalState((currentState) => ({
      ...currentState,
      isLoading: true,
      open: true,
      provider
    }));
    try {
      const models = await fetchProviderModels(apiBaseUrl, provider.id);
      setProviderModelsModalState({
        isLoading: false,
        isSubmitting: false,
        models,
        open: true,
        provider
      });
      updateProviderModelCount(provider.id, models.length);
      return models;
    } catch {
      setProviderModelsModalState({
        isLoading: false,
        isSubmitting: false,
        models: [],
        open: true,
        provider
      });
      return [];
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

  const submitCustomProvider = async (values: CustomModelProviderFormValues) => {
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

  const submitProviderModel = async (
    mode: "create" | "edit",
    values: ProviderModelFormValues,
    modelId?: string
  ) => {
    const provider = providerModelsModalState.provider;
    if (!provider) {
      return;
    }
    setProviderModelsModalState((currentState) => ({
      ...currentState,
      isSubmitting: true
    }));
    try {
      const response = await fetch(
        mode === "create"
          ? createProviderModelsUrl(apiBaseUrl, provider.id)
          : createProviderModelUrl(apiBaseUrl, provider.id, modelId ?? ""),
        {
          body: JSON.stringify(
            mode === "create"
              ? {
                  api: values.api,
                  contextWindow: values.contextWindow,
                  input: values.input,
                  maxTokens: values.maxTokens,
                  modelId: values.modelId,
                  name: values.name,
                  reasoning: values.reasoning
                }
              : {
                  api: values.api,
                  contextWindow: values.contextWindow,
                  input: values.input,
                  maxTokens: values.maxTokens,
                  name: values.name,
                  reasoning: values.reasoning
                }
          ),
          headers: {
            "Content-Type": "application/json"
          },
          method: mode === "create" ? "POST" : "PUT"
        }
      );

      if (!response.ok) {
        throw new Error(
          mode === "create" ? "Failed to create model" : "Failed to update model"
        );
      }
      await refreshProviderModels(provider);
    } finally {
      setProviderModelsModalState((currentState) => ({
        ...currentState,
        isSubmitting: false
      }));
    }
  };

  const deleteProviderModel = async (model: ModelSummary) => {
    const provider = providerModelsModalState.provider;
    if (!provider) {
      return;
    }
    setProviderModelsModalState((currentState) => ({
      ...currentState,
      isSubmitting: true
    }));
    try {
      const response = await fetch(
        createProviderModelUrl(apiBaseUrl, provider.id, model.id),
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete model");
      }
      await refreshProviderModels(provider);
    } finally {
      setProviderModelsModalState((currentState) => ({
        ...currentState,
        isSubmitting: false
      }));
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
        <Empty
          description="暂无模型提供商"
          image={<ModelProvidersEmptyImage />}
          style={{ color: "var(--app-color-text)" }}
        />
      ) : null}

      {loadState.status === "success" ? (
        <ModelProviderGroups
          groupedProviders={groupedProviders}
          hoveredProviderKey={hoveredProviderKey}
          onAddProvider={() => {
            setCustomProviderModalState({
              mode: "create",
              open: true
            });
          }}
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
          onHoverChange={setHoveredProviderKey}
          onViewModels={(nextProvider) => {
            void refreshProviderModels(nextProvider);
          }}
        />
      ) : null}

      <ProviderApiKeyModal
        isSubmitting={isSavingApiKey}
        onCancel={() => {
          setEditingProviderId(null);
          setApiKeyInput("");
        }}
        onChange={setApiKeyInput}
        onSubmit={submitApiKey}
        open={editingProviderId !== null}
        providerId={editingProviderId}
        value={apiKeyInput}
      />
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
      {providerModelsModalState.open || providerModelsModalState.provider ? (
        <ProviderModelsModal
          isLoading={providerModelsModalState.isLoading}
          isSubmitting={providerModelsModalState.isSubmitting}
          models={providerModelsModalState.models}
          onClose={() => {
            setProviderModelsModalState({
              isLoading: false,
              isSubmitting: false,
              models: [],
              open: false,
              provider: null
            });
          }}
          onCreate={async (values) => {
            await submitProviderModel("create", values);
          }}
          onDelete={async (model) => {
            await deleteProviderModel(model);
          }}
          onUpdate={async (modelId, values) => {
            await submitProviderModel("edit", values, modelId);
          }}
          open={providerModelsModalState.open}
          provider={providerModelsModalState.provider}
        />
      ) : null}
    </Flex>
  );
}
