import { useCallback, useEffect, useRef, useState } from "react";
import { DeleteOutlined, HolderOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Form, Select, Tag } from "antd";

import { ModelProxyLimitList } from "./model-proxy-limit-list";
import type {
  ModelProxyWindowType,
  ModelProviderSummary,
  ModelSummary
} from "./model-provider-types";

export interface ModelProxyCandidateFormValue {
  limits: {
    maxTokens: number;
    windowHours?: number;
    windowType: ModelProxyWindowType;
  }[];
  modelId: string;
  provider: string;
}

interface ModelProxyCandidateListProps {
  candidateProviders: ModelProviderSummary[];
  createCandidate: () => Promise<ModelProxyCandidateFormValue>;
  loadProviderModels: (providerId: string) => Promise<ModelSummary[]>;
  modelOptions: Record<string, ModelSummary[]>;
}

const AUTO_SCROLL_EDGE_SIZE = 48;
const AUTO_SCROLL_MAX_SPEED = 24;

export function ModelProxyCandidateList({
  candidateProviders,
  createCandidate,
  loadProviderModels,
  modelOptions
}: ModelProxyCandidateListProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const scrollSpeedRef = useRef(0);

  const stopAutoScroll = useCallback(() => {
    scrollSpeedRef.current = 0;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const runAutoScroll = useCallback(function scrollFrame() {
    const container = scrollContainerRef.current;
    if (!container || scrollSpeedRef.current === 0) {
      animationFrameRef.current = null;
      return;
    }
    container.scrollTop += scrollSpeedRef.current;
    animationFrameRef.current = window.requestAnimationFrame(scrollFrame);
  }, []);

  useEffect(() => {
    if (draggedIndex === null) return undefined;
    const handleDragOver = (event: DragEvent) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const { bottom, top } = container.getBoundingClientRect();
      let speed = 0;
      if (event.clientY < top + AUTO_SCROLL_EDGE_SIZE) {
        speed = -Math.min(
          AUTO_SCROLL_MAX_SPEED,
          Math.max(4, (top + AUTO_SCROLL_EDGE_SIZE - event.clientY) / 3)
        );
      } else if (event.clientY > bottom - AUTO_SCROLL_EDGE_SIZE) {
        speed = Math.min(
          AUTO_SCROLL_MAX_SPEED,
          Math.max(4, (event.clientY - bottom + AUTO_SCROLL_EDGE_SIZE) / 3)
        );
      }
      scrollSpeedRef.current = speed;
      if (speed === 0) {
        stopAutoScroll();
      } else if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(runAutoScroll);
      }
    };
    document.addEventListener("dragover", handleDragOver);
    return () => {
      document.removeEventListener("dragover", handleDragOver);
      stopAutoScroll();
    };
  }, [draggedIndex, runAutoScroll, stopAutoScroll]);

  const clearDrag = () => {
    stopAutoScroll();
    scrollContainerRef.current = null;
    setDraggedIndex(null);
    setDragTargetIndex(null);
  };

  return (
    <Form.List name="candidates">
      {(candidateFields, { add, move, remove }) => (
        <Flex gap={12} vertical>
          {candidateFields.map((candidateField, candidateIndex) => (
            <Card
              data-testid="model-proxy-candidate-card"
              key={candidateField.key}
              onDragOver={(event) => {
                if (draggedIndex === null) return;
                event.preventDefault();
                setDragTargetIndex(candidateIndex);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedIndex !== null && draggedIndex !== candidateIndex) {
                  move(draggedIndex, candidateIndex);
                }
                clearDrag();
              }}
              size="small"
              title={
                <Flex align="center" gap={8}>
                  <Button
                    aria-label={`拖拽候选 ${candidateIndex + 1}`}
                    draggable
                    icon={<HolderOutlined />}
                    onDragEnd={clearDrag}
                    onDragStart={(event) => {
                      const card = event.currentTarget.closest<HTMLElement>(
                        '[data-testid="model-proxy-candidate-card"]'
                      );
                      if (card) {
                        const { left, top } = card.getBoundingClientRect();
                        event.dataTransfer.setDragImage(
                          card,
                          Math.max(0, event.clientX - left),
                          Math.max(0, event.clientY - top)
                        );
                        scrollContainerRef.current = card.closest<HTMLElement>(
                          "[data-model-proxy-scroll-container]"
                        );
                      }
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(candidateIndex));
                      setDraggedIndex(candidateIndex);
                    }}
                    shape="circle"
                    size="small"
                    style={{ cursor: "grab" }}
                    type="text"
                  />
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
                borderColor:
                  draggedIndex !== null &&
                  dragTargetIndex === candidateIndex &&
                  draggedIndex !== candidateIndex
                    ? "var(--app-color-primary)"
                    : "var(--app-color-border-secondary)"
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
                              (model) => ({ label: model.name, value: model.id })
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
              void createCandidate().then((candidate) => add(candidate));
            }}
          >
            添加候选
          </Button>
        </Flex>
      )}
    </Form.List>
  );
}
