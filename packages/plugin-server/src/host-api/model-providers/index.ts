import type { HostApiRequest, HostApiResult } from "..";

export interface HostApiModelProviderSummary {
  readonly baseUrl?: string;
  readonly hasApiKey: boolean;
  readonly id: string;
  readonly modelCount: number;
  readonly source: "builtin" | "custom" | "proxy";
}

export interface HostApiCustomModelProviderSummary {
  readonly baseUrl: string;
  readonly createdAt: string;
  readonly id: string;
  readonly provider: string;
  readonly updatedAt: string;
}

export interface HostApiCustomModelProviderInput {
  readonly baseUrl: string;
  readonly provider: string;
}

export interface HostApiUpdateCustomModelProviderInput
  extends HostApiCustomModelProviderInput {
  readonly currentProvider: string;
}

export interface HostApiModelProviderInput {
  readonly provider: string;
}

export interface HostApiModelSummary {
  readonly api: string;
  readonly contextWindow: number;
  readonly id: string;
  readonly input: readonly string[];
  readonly maxTokens: number;
  readonly name: string;
  readonly provider: string;
  readonly reasoning: boolean;
}

export interface HostApiCreateModelInput
  extends Omit<HostApiModelSummary, "id"> {
  readonly modelId: string;
}

export interface HostApiUpdateModelInput extends HostApiCreateModelInput {}

export interface HostApiProviderModelInput extends HostApiModelProviderInput {
  readonly modelId: string;
}

export interface HostApiProviderApiKeyInput extends HostApiModelProviderInput {
  readonly apiKey: string;
}

export interface HostApiDeletedCustomModelProviderResult {
  readonly provider: string;
}

export interface HostApiDeletedProviderModelResult {
  readonly modelId: string;
  readonly provider: string;
}

export interface HostApiProviderApiKeyResult {
  readonly hasApiKey: boolean;
  readonly provider: string;
}

export interface HostApiModelProvidersClient {
  readonly createCustom: (
    input: HostApiCustomModelProviderInput
  ) => Promise<HostApiResult<HostApiCustomModelProviderSummary>>;
  readonly createModel: (
    input: HostApiCreateModelInput
  ) => Promise<HostApiResult<HostApiModelSummary>>;
  readonly deleteCustom: (
    input: HostApiModelProviderInput
  ) => Promise<HostApiResult<HostApiDeletedCustomModelProviderResult>>;
  readonly deleteModel: (
    input: HostApiProviderModelInput
  ) => Promise<HostApiResult<HostApiDeletedProviderModelResult>>;
  readonly list: () => Promise<HostApiResult<readonly HostApiModelProviderSummary[]>>;
  readonly listModels: (
    input: HostApiModelProviderInput
  ) => Promise<HostApiResult<readonly HostApiModelSummary[]>>;
  readonly storeApiKey: (
    input: HostApiProviderApiKeyInput
  ) => Promise<HostApiResult<HostApiProviderApiKeyResult>>;
  readonly updateCustom: (
    input: HostApiUpdateCustomModelProviderInput
  ) => Promise<HostApiResult<HostApiCustomModelProviderSummary>>;
  readonly updateModel: (
    input: HostApiUpdateModelInput
  ) => Promise<HostApiResult<HostApiModelSummary>>;
}

export function createModelProvidersApi(
  request: HostApiRequest
): HostApiModelProvidersClient {
  return {
    createCustom(input) {
      return request<HostApiCustomModelProviderSummary>({
        body: input,
        method: "POST",
        path: "/api/v1/model-providers/custom"
      });
    },
    createModel(input) {
      const { provider, ...body } = input;

      return request<HostApiModelSummary>({
        body,
        method: "POST",
        path: getProviderModelsPath(provider)
      });
    },
    deleteCustom(input) {
      return request<HostApiDeletedCustomModelProviderResult>({
        method: "DELETE",
        path: getCustomProviderPath(input.provider)
      });
    },
    deleteModel(input) {
      return request<HostApiDeletedProviderModelResult>({
        method: "DELETE",
        path: getProviderModelPath(input.provider, input.modelId)
      });
    },
    list() {
      return request<readonly HostApiModelProviderSummary[]>({
        path: "/api/v1/model-providers"
      });
    },
    listModels(input) {
      return request<readonly HostApiModelSummary[]>({
        path: getProviderModelsPath(input.provider)
      });
    },
    storeApiKey(input) {
      return request<HostApiProviderApiKeyResult>({
        body: { apiKey: input.apiKey },
        method: "PUT",
        path: `/api/v1/model-providers/${encodeURIComponent(input.provider)}/api-key`
      });
    },
    updateCustom(input) {
      return request<HostApiCustomModelProviderSummary>({
        body: {
          baseUrl: input.baseUrl,
          provider: input.provider
        },
        method: "PUT",
        path: getCustomProviderPath(input.currentProvider)
      });
    },
    updateModel(input) {
      const { modelId, provider, ...body } = input;

      return request<HostApiModelSummary>({
        body,
        method: "PUT",
        path: getProviderModelPath(provider, modelId)
      });
    }
  };
}

function getCustomProviderPath(provider: string): string {
  return `/api/v1/model-providers/custom/${encodeURIComponent(provider)}`;
}

function getProviderModelsPath(provider: string): string {
  return `/api/v1/model-providers/${encodeURIComponent(provider)}/models`;
}

function getProviderModelPath(provider: string, modelId: string): string {
  return `${getProviderModelsPath(provider)}/${encodeURIComponent(modelId)}`;
}
