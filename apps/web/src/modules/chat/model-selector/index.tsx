import { DownOutlined } from "@ant-design/icons";
import { Cascader, ConfigProvider } from "antd";
import type { CascaderProps } from "antd";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  fetchCachedProviderModels,
  fetchModelProviders,
} from "../../model-providers/model-provider-api";
import type {
  ModelProviderSummary,
  ModelSummary
} from "../../model-providers/model-provider-types";

interface ModelCascaderOption {
  children?: ModelCascaderOption[];
  input?: string[];
  isLeaf?: boolean;
  label: string;
  loading?: boolean;
  reasoning?: boolean;
  value: string;
}

interface ProviderOption extends ModelCascaderOption {
  children: ModelCascaderOption[];
  isLeaf: false;
}

export interface SelectedModel {
  input?: string[];
  modelId: string;
  providerId: string;
  reasoning?: boolean;
}

interface ModelSelectorProps {
  apiBaseUrl: string;
  className?: string;
  onChange?: (value: SelectedModel) => void;
  style?: CSSProperties;
  value?: SelectedModel | undefined;
  variant?: "borderless" | "outlined";
}

const modelCascaderTheme = {
  components: {
    Cascader: {
      colorText: "var(--app-color-text)",
      colorTextPlaceholder: "var(--app-color-text)",
      controlItemBgActive:
        "color-mix(in srgb, var(--app-color-primary) 16%, var(--app-color-bg-elevated))",
      optionSelectedBg:
        "color-mix(in srgb, var(--app-color-primary) 16%, var(--app-color-bg-elevated))",
      optionSelectedColor: "var(--app-color-text)"
    }
  }
} as const;

export function buildConfiguredProviderOptions(
  providers: ModelProviderSummary[]
): ProviderOption[] {
  return providers
    .filter((provider) => provider.hasApiKey)
    .map((provider) => ({
      children: [],
      isLeaf: false,
      label: provider.id,
      value: provider.id
    }));
}

export function isModelSelection(value: unknown[]): value is [string, string] {
  return (
    value.length === 2 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string"
  );
}

function buildModelOptions(models: ModelSummary[]): ModelCascaderOption[] {
  return models.map((model) => ({
    isLeaf: true,
    input: model.input,
    label: model.name,
    reasoning: model.reasoning,
    value: model.id
  }));
}

function toCascaderValue(value?: SelectedModel): string[] | undefined {
  return value ? [value.providerId, value.modelId] : undefined;
}

function setProviderModels(
  options: ProviderOption[],
  providerId: string,
  models: ModelSummary[]
): ProviderOption[] {
  return options.map((option) =>
    option.value === providerId
      ? {
          ...option,
          children: buildModelOptions(models),
          loading: false
        }
      : option
  );
}

export function ModelSelector({
  apiBaseUrl,
  className,
  onChange,
  style,
  variant = "borderless",
  value
}: ModelSelectorProps) {
  const [options, setOptions] = useState<ProviderOption[]>([]);
  const [selectedValue, setSelectedValue] = useState<string[] | undefined>(
    toCascaderValue(value)
  );

  useEffect(() => {
    setSelectedValue(toCascaderValue(value));
  }, [value]);

  useEffect(() => {
    let isCurrent = true;

    void fetchModelProviders(apiBaseUrl).then((providers) => {
      if (isCurrent) {
        const nextOptions = buildConfiguredProviderOptions(providers);
        setOptions(nextOptions);

        if (nextOptions.some((option) => option.value === "local")) {
          void fetchCachedProviderModels(apiBaseUrl, "local").then((models) => {
            if (isCurrent) {
              setOptions((currentOptions) =>
                setProviderModels(currentOptions, "local", models)
              );
            }
          });
        }
      }
    });

    return () => {
      isCurrent = false;
    };
  }, [apiBaseUrl]);

  const loadData = useCallback<
    Required<CascaderProps<ModelCascaderOption, "value", false>>["loadData"]
  >(
    (selectedOptions) => {
      const providerOption = selectedOptions[0] as ProviderOption | undefined;

      if (!providerOption || providerOption.children.length > 0) {
        return;
      }

      providerOption.loading = true;
      setOptions([...options]);

      void fetchCachedProviderModels(apiBaseUrl, providerOption.value).then(
        (models) => {
          providerOption.loading = false;
          providerOption.children = buildModelOptions(models);
          setOptions([...options]);
        }
      );
    },
    [apiBaseUrl, options]
  );

  const cascaderValue = useMemo(
    () => (value ? toCascaderValue(value) : selectedValue),
    [selectedValue, value]
  );

  return (
    <ConfigProvider theme={modelCascaderTheme}>
      <Cascader<ModelCascaderOption, "value">
        aria-label="模型"
        allowClear={false}
        changeOnSelect={false}
        displayRender={(labels) => labels[labels.length - 1] ?? ""}
        loadData={loadData}
        multiple={false}
        options={options}
        placeholder="选择模型"
        popupMatchSelectWidth={false}
        size="small"
        style={style ?? { width: "fit-content" }}
        suffixIcon={<DownOutlined style={{ color: "var(--app-color-text)" }} />}
        value={cascaderValue ?? []}
        variant={variant}
        {...(className === undefined ? {} : { className })}
        onChange={(nextValue, selectedOptions) => {
          if (!isModelSelection(nextValue)) {
            return;
          }

          const selectedModel = selectedOptions[1];
          setSelectedValue(nextValue);
          onChange?.({
            input: selectedModel?.input ?? [],
            modelId: nextValue[1],
            providerId: nextValue[0],
            reasoning: selectedModel?.reasoning === true
          });
        }}
      />
    </ConfigProvider>
  );
}
