import { useCallback, useEffect, useMemo, useState } from "react";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import {
  Button,
  Card,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Tag,
  Typography
} from "antd";

import {
  createModelProxiesUrl,
  createModelProxyUrl,
  fetchModelProxies,
  fetchModelProviders,
  fetchProviderModels
} from "./model-provider-api";
import {
  DEFAULT_MODEL_PROXY_LIMIT,
  ModelProxyLimitList
} from "./model-proxy-limit-list";
import type {
  ModelProxySummary,
  ModelProxyWindowType,
  ModelProviderSummary,
  ModelSummary
} from "./model-provider-types";

interface ModelProxyPanelProps {
  apiBaseUrl: string;
  onChanged: () => Promise<void> | void;
}

interface ProxyFormValues {
  candidates: {
    limits: {
      maxTokens: number;
      windowHours?: number;
      windowType: ModelProxyWindowType;
    }[];
    modelId: string;
    provider: string;
  }[];
  name: string;
}

export function ModelProxyPanel({
  apiBaseUrl,
  onChanged
}: ModelProxyPanelProps) {
  const [form] = Form.useForm<ProxyFormValues>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [hoveredProxyId, setHoveredProxyId] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<Record<string, ModelSummary[]>>({});
  const [providers, setProviders] = useState<ModelProviderSummary[]>([]);
  const [proxies, setProxies] = useState<ModelProxySummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const candidateProviders = useMemo(
    () =>
      providers.filter(
        (provider) => provider.source !== "proxy" && provider.hasApiKey
      ),
    [providers]
  );

  const refreshProxies = useCallback(async () => {
    setProxies(await fetchModelProxies(apiBaseUrl));
  }, [apiBaseUrl]);

  const refreshProviders = useCallback(async () => {
    setProviders(await fetchModelProviders(apiBaseUrl));
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshProxies();
  }, [refreshProxies]);

  const loadProviderModels = async (providerId: string): Promise<ModelSummary[]> => {
    if (modelOptions[providerId]) return modelOptions[providerId];
    const models = await fetchProviderModels(apiBaseUrl, providerId);
    setModelOptions((current) => ({ ...current, [providerId]: models }));
    return models;
  };

  const buildInitialCandidate = async () => {
    const latestProviders = await fetchModelProviders(apiBaseUrl);
    setProviders(latestProviders);
    const providerId =
      latestProviders.find(
        (provider) => provider.source !== "proxy" && provider.hasApiKey
      )?.id ?? "";
    const models = providerId ? await loadProviderModels(providerId) : [];
    return {
      limits: [{ ...DEFAULT_MODEL_PROXY_LIMIT }],
      modelId: models[0]?.id ?? "",
      provider: providerId
    };
  };

  const startCreate = async () => {
    setIsModalOpen(true);
    setEditingModelId(null);
    form.setFieldsValue({
      candidates: [await buildInitialCandidate()],
      name: ""
    });
  };

  const startEdit = async (proxy: ModelProxySummary) => {
    await refreshProviders();
    const proxyDetails =
      proxy.candidates.length > 0
        ? proxy
        : (await fetchModelProxies(apiBaseUrl)).find(
            (item) => item.modelId === proxy.modelId || item.name === proxy.name
          );
    if (!proxyDetails) return;
    setIsModalOpen(true);
    setEditingModelId(proxyDetails.modelId);
    await Promise.all(
      proxyDetails.candidates.map((candidate) => loadProviderModels(candidate.provider))
    );
    form.setFieldsValue({
      candidates: proxyDetails.candidates.map((candidate) => ({
        limits: candidate.limits.map((limit) => ({
          maxTokens: limit.maxTokens,
          ...(limit.windowHours === undefined || limit.windowHours === null
            ? {}
            : { windowHours: limit.windowHours }),
          windowType: limit.windowType
        })),
        modelId: candidate.modelId,
        provider: candidate.provider
      })),
      name: proxyDetails.name
    });
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingModelId(null);
    form.resetFields();
  };

  const submit = async (values: ProxyFormValues) => {
    setIsSubmitting(true);
    try {
      const body = {
        candidates: values.candidates.map((candidate, index) => ({
          limits: candidate.limits.map((limit) => ({
            maxTokens: Number(limit.maxTokens),
            ...(limit.windowType === "hours"
              ? { windowHours: Number(limit.windowHours) }
              : {}),
            windowType: limit.windowType
          })),
          modelId: candidate.modelId,
          priority: index + 1,
          provider: candidate.provider
        })),
        ...(editingModelId ? { modelId: editingModelId } : {}),
        name: values.name.trim()
      };
      const response = await fetch(
        editingModelId
          ? createModelProxyUrl(apiBaseUrl, editingModelId)
          : createModelProxiesUrl(apiBaseUrl),
        {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
          method: editingModelId ? "PUT" : "POST"
        }
      );
      if (!response.ok) throw new Error("Failed to save model proxy");
      await refreshProxies();
      await onChanged();
      closeModal();
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteProxy = async (modelId: string) => {
    const response = await fetch(createModelProxyUrl(apiBaseUrl, modelId), {
      method: "DELETE"
    });
    if (!response.ok) throw new Error("Failed to delete model proxy");
    await refreshProxies();
    await onChanged();
  };

  return (
    <Flex gap={12} vertical>
      <Flex align="center" justify="space-between">
        <Typography.Title level={4} style={{ margin: 0 }}>
          模型代理
        </Typography.Title>
        <Button icon={<PlusOutlined />} onClick={() => void startCreate()}>
          新建代理
        </Button>
      </Flex>
      {proxies.length === 0 ? (
        <Empty description="还没有模型代理。" />
      ) : (
        <Flex gap={12} wrap>
          {proxies.map((proxy) => (
            <Card
              data-testid="model-proxy-card"
              key={proxy.modelId}
              onMouseEnter={() => setHoveredProxyId(proxy.modelId)}
              onMouseLeave={() => setHoveredProxyId(null)}
              size="small"
              style={{
                background: "var(--app-color-bg-container)",
                borderColor: "var(--app-color-border-secondary)",
                boxShadow:
                  hoveredProxyId === proxy.modelId
                    ? "0 14px 30px var(--app-color-shadow)"
                    : "0 8px 18px color-mix(in srgb, var(--app-color-shadow) 40%, transparent)",
                flex: "1 1 260px",
                minWidth: 260,
                transform:
                  hoveredProxyId === proxy.modelId ? "translateY(-4px)" : "translateY(0)",
                transition:
                  "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
              }}
              styles={{
                body: {
                  padding: 14
                }
              }}
            >
              <Flex align="center" justify="space-between">
                <Flex gap={6} vertical>
                  <Typography.Text strong>{proxy.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {`local/${proxy.modelId}`}
                  </Typography.Text>
                </Flex>
                <Flex gap={6}>
                  <Button
                    aria-label={`编辑代理 ${proxy.modelId}`}
                    icon={<EditOutlined />}
                    onClick={() => void startEdit(proxy)}
                    shape="circle"
                    size="small"
                    type="text"
                  />
                  <Popconfirm
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    okText="删除"
                    onConfirm={() => void deleteProxy(proxy.modelId)}
                    title={`确认删除代理 ${proxy.modelId} 吗？`}
                  >
                    <Button
                      aria-label={`删除代理 ${proxy.modelId}`}
                      icon={<DeleteOutlined />}
                      shape="circle"
                      size="small"
                      style={{ color: "var(--app-color-danger)" }}
                      type="text"
                    />
                  </Popconfirm>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Flex>
      )}
      <Modal
        cancelText="取消"
        okButtonProps={{ loading: isSubmitting }}
        okText={editingModelId ? "保存代理" : "创建代理"}
        onCancel={closeModal}
        onOk={() => {
          void form.submit();
        }}
        open={isModalOpen}
        title={editingModelId ? "编辑代理" : "新建代理"}
        width={820}
        styles={{
          body: {
            maxHeight: "65vh",
            overflowY: "auto"
          }
        }}
      >
        <Form<ProxyFormValues> form={form} layout="vertical" onFinish={submit}>
          <Form.Item
            label="代理名称"
            name="name"
            rules={[{ required: true, message: "请输入代理名称" }]}
          >
            <Input aria-label="代理名称" placeholder="例如 Coding Agent" />
          </Form.Item>
          <Form.List name="candidates">
            {(candidateFields, { add, remove }) => (
              <Flex gap={12} vertical>
                {candidateFields.map((candidateField, candidateIndex) => (
                  <Card
                    data-testid="model-proxy-candidate-card"
                    key={candidateField.key}
                    size="small"
                    title={
                      <Flex align="center" gap={8}>
                        <span>{`候选 ${candidateIndex + 1}`}</span>
                        <Tag>{`优先级 ${candidateIndex + 1}`}</Tag>
                      </Flex>
                    }
                    extra={
                      candidateFields.length > 1 ? (
                        <Button
                          aria-label={`移除候选 ${candidateIndex + 1}`}
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(candidateField.name)}
                          shape="circle"
                          size="small"
                          type="text"
                        />
                      ) : null
                    }
                    style={{
                      background: "var(--app-color-bg-container)",
                      borderColor: "var(--app-color-border-secondary)"
                    }}
                  >
                    <Flex gap={10} vertical>
                      <Flex gap={10} wrap>
                        <Form.Item
                          label="提供商"
                          name={[candidateField.name, "provider"]}
                          rules={[{ required: true, message: "请选择提供商" }]}
                        >
                          <Select
                            aria-label={`候选 ${candidateIndex + 1} 提供商`}
                            onChange={(providerId) => void loadProviderModels(providerId)}
                            options={candidateProviders.map((provider) => ({
                              label: provider.id,
                              value: provider.id
                            }))}
                            style={{ minWidth: 180 }}
                          />
                        </Form.Item>
                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue }) => {
                            const providerId = getFieldValue([
                              "candidates",
                              candidateField.name,
                              "provider"
                            ]) as string | undefined;
                            return (
                              <Form.Item
                                label="模型"
                                name={[candidateField.name, "modelId"]}
                                rules={[{ required: true, message: "请选择模型" }]}
                              >
                                <Select
                                  aria-label={`候选 ${candidateIndex + 1} 模型`}
                                  options={(modelOptions[providerId ?? ""] ?? []).map(
                                    (model) => ({
                                      label: model.name,
                                      value: model.id
                                    })
                                  )}
                                  style={{ minWidth: 240 }}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </Flex>
                      <ModelProxyLimitList candidateFieldName={candidateField.name} />
                    </Flex>
                  </Card>
                ))}
                <Button
                  onClick={() => {
                    void buildInitialCandidate().then((candidate) => add(candidate));
                  }}
                >
                  添加候选
                </Button>
              </Flex>
            )}
          </Form.List>
        </Form>
      </Modal>
    </Flex>
  );
}
