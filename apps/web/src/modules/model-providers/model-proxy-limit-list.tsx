import { DeleteOutlined } from "@ant-design/icons";
import { Button, Flex, Form, InputNumber, Select } from "antd";

import type { ModelProxyWindowType } from "./model-provider-types";

const WINDOW_OPTIONS: { label: string; value: ModelProxyWindowType }[] = [
  { label: "滚动小时", value: "hours" },
  { label: "UTC 日", value: "day" },
  { label: "UTC 周", value: "week" }
];

export const DEFAULT_MODEL_PROXY_LIMIT = {
  maxTokens: 100000,
  windowHours: 24,
  windowType: "hours" as const
};

interface ModelProxyLimitListProps {
  candidateFieldName: number;
}

export function ModelProxyLimitList({
  candidateFieldName
}: ModelProxyLimitListProps) {
  return (
    <Form.List name={[candidateFieldName, "limits"]}>
      {(limitFields, limitOps) => (
        <Flex gap={8} vertical>
          {limitFields.map((limitField) => (
            <Flex align="end" gap={8} key={limitField.key}>
              <Form.Item
                label="窗口"
                name={[limitField.name, "windowType"]}
                rules={[{ required: true, message: "请选择窗口" }]}
                style={{ flex: 1, marginBottom: 0, minWidth: 0 }}
              >
                <Select
                  aria-label="窗口"
                  options={WINDOW_OPTIONS}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item shouldUpdate noStyle>
                {({ getFieldValue }) => {
                  const windowType = getFieldValue([
                    "candidates",
                    candidateFieldName,
                    "limits",
                    limitField.name,
                    "windowType"
                  ]) as ModelProxyWindowType | undefined;

                  return windowType === "hours" ? (
                    <Form.Item
                      label="小时"
                      name={[limitField.name, "windowHours"]}
                      style={{ flex: 1, marginBottom: 0, minWidth: 0 }}
                    >
                      <InputNumber
                        aria-label="小时"
                        min={1}
                        style={{ width: "100%" }}
                      />
                    </Form.Item>
                  ) : null;
                }}
              </Form.Item>
              <Form.Item
                label="最大 Tokens"
                name={[limitField.name, "maxTokens"]}
                rules={[{ required: true, message: "请输入限制" }]}
                style={{ flex: 1, marginBottom: 0, minWidth: 0 }}
              >
                <InputNumber
                  aria-label="最大 Tokens"
                  min={1}
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Button
                aria-label="移除限制"
                icon={<DeleteOutlined />}
                onClick={() => limitOps.remove(limitField.name)}
                shape="circle"
                style={{ color: "var(--app-color-danger)", flex: "0 0 auto" }}
                type="text"
              />
            </Flex>
          ))}
          <Button onClick={() => limitOps.add({ ...DEFAULT_MODEL_PROXY_LIMIT })}>
            添加限制
          </Button>
        </Flex>
      )}
    </Form.List>
  );
}
