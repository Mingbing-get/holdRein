import type { HostApiRequest, HostApiResult } from "..";

export type HostApiModelProxyWindowType = "day" | "hours" | "week";

export interface HostApiModelProxyLimit {
  readonly id?: string;
  readonly maxTokens: number;
  readonly windowHours?: number | null;
  readonly windowType: HostApiModelProxyWindowType;
}

export interface HostApiModelProxyCandidate {
  readonly id?: string;
  readonly limits: readonly HostApiModelProxyLimit[];
  readonly modelId: string;
  readonly priority: number;
  readonly provider: string;
}

export interface HostApiModelProxyInput {
  readonly candidates: readonly HostApiModelProxyCandidate[];
  readonly modelId?: string;
  readonly name: string;
}

export interface HostApiUpdateModelProxyInput extends HostApiModelProxyInput {
  readonly currentModelId: string;
}

export interface HostApiModelProxyIdInput {
  readonly modelId: string;
}

export interface HostApiModelProxySummary {
  readonly candidates: readonly HostApiModelProxyCandidate[];
  readonly createdAt?: string;
  readonly id?: string;
  readonly modelId: string;
  readonly name: string;
  readonly updatedAt?: string;
}

export interface HostApiDeletedModelProxyResult {
  readonly modelId: string;
}

export interface HostApiModelProxiesClient {
  readonly create: (
    input: HostApiModelProxyInput
  ) => Promise<HostApiResult<HostApiModelProxySummary>>;
  readonly delete: (
    input: HostApiModelProxyIdInput
  ) => Promise<HostApiResult<HostApiDeletedModelProxyResult>>;
  readonly get: (
    input: HostApiModelProxyIdInput
  ) => Promise<HostApiResult<HostApiModelProxySummary>>;
  readonly list: () => Promise<HostApiResult<readonly HostApiModelProxySummary[]>>;
  readonly update: (
    input: HostApiUpdateModelProxyInput
  ) => Promise<HostApiResult<HostApiModelProxySummary>>;
}

export function createModelProxiesApi(
  request: HostApiRequest
): HostApiModelProxiesClient {
  return {
    create(input) {
      return request<HostApiModelProxySummary>({
        body: input,
        method: "POST",
        path: "/api/v1/model-proxies"
      });
    },
    delete(input) {
      return request<HostApiDeletedModelProxyResult>({
        method: "DELETE",
        path: getModelProxyPath(input.modelId)
      });
    },
    get(input) {
      return request<HostApiModelProxySummary>({
        path: getModelProxyPath(input.modelId)
      });
    },
    list() {
      return request<readonly HostApiModelProxySummary[]>({
        path: "/api/v1/model-proxies"
      });
    },
    update(input) {
      const { currentModelId, ...body } = input;

      return request<HostApiModelProxySummary>({
        body,
        method: "PUT",
        path: getModelProxyPath(currentModelId)
      });
    }
  };
}

function getModelProxyPath(modelId: string): string {
  return `/api/v1/model-proxies/${encodeURIComponent(modelId)}`;
}
