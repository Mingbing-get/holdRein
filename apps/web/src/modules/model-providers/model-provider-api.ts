import type {
  ApiResponse,
  ModelProxySummary,
  ModelProviderSummary,
  ModelSummary
} from "./model-provider-types";

const providerModelsCache = new Map<string, Promise<ModelSummary[]>>();

export async function fetchModelProviders(
  apiBaseUrl: string
): Promise<ModelProviderSummary[]> {
  const response = await fetch(createModelProvidersUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load model providers");
  }

  const payload = (await response.json()) as ApiResponse<ModelProviderSummary[]>;

  return sortProviders(payload.data);
}

export async function fetchProviderModels(
  apiBaseUrl: string,
  providerId: string
): Promise<ModelSummary[]> {
  const response = await fetch(createProviderModelsUrl(apiBaseUrl, providerId));

  if (!response.ok) {
    throw new Error("Failed to load provider models");
  }

  const payload = (await response.json()) as ApiResponse<ModelSummary[]>;

  return payload.data;
}

export function fetchCachedProviderModels(
  apiBaseUrl: string,
  providerId: string
): Promise<ModelSummary[]> {
  const cacheKey = createProviderModelsCacheKey(apiBaseUrl, providerId);
  const cachedModels = providerModelsCache.get(cacheKey);

  if (cachedModels) {
    return cachedModels;
  }

  const modelsPromise = fetchProviderModels(apiBaseUrl, providerId).catch((error) => {
    providerModelsCache.delete(cacheKey);
    throw error;
  });
  providerModelsCache.set(cacheKey, modelsPromise);
  return modelsPromise;
}

export function invalidateProviderModelsCache(
  apiBaseUrl?: string,
  providerId?: string
): void {
  if (!apiBaseUrl) {
    providerModelsCache.clear();
    return;
  }

  if (providerId) {
    providerModelsCache.delete(createProviderModelsCacheKey(apiBaseUrl, providerId));
    return;
  }

  const prefix = `${normalizeApiBaseUrl(apiBaseUrl)}::`;
  for (const cacheKey of providerModelsCache.keys()) {
    if (cacheKey.startsWith(prefix)) {
      providerModelsCache.delete(cacheKey);
    }
  }
}

export async function fetchModelProxies(
  apiBaseUrl: string
): Promise<ModelProxySummary[]> {
  const response = await fetch(createModelProxiesUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load model proxies");
  }

  const payload = (await response.json()) as ApiResponse<ModelProxySummary[]>;

  return payload.data;
}

export function createModelProvidersUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/model-providers`;
}

export function createModelProxiesUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/model-proxies`;
}

export function createModelProxyUrl(apiBaseUrl: string, modelId: string): string {
  return `${createModelProxiesUrl(apiBaseUrl)}/${modelId}`;
}

export function createCustomModelProviderUrl(apiBaseUrl: string): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/custom`;
}

export function createProviderApiKeyUrl(
  apiBaseUrl: string,
  providerId: string
): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/${providerId}/api-key`;
}

export function createUpdateCustomModelProviderUrl(
  apiBaseUrl: string,
  providerId: string
): string {
  return `${createCustomModelProviderUrl(apiBaseUrl)}/${providerId}`;
}

export function createProviderModelsUrl(
  apiBaseUrl: string,
  providerId: string
): string {
  return `${createModelProvidersUrl(apiBaseUrl)}/${providerId}/models`;
}

export function createProviderModelUrl(
  apiBaseUrl: string,
  providerId: string,
  modelId: string
): string {
  return `${createProviderModelsUrl(apiBaseUrl, providerId)}/${modelId}`;
}

function sortProviders(providers: ModelProviderSummary[]): ModelProviderSummary[] {
  return [...providers].sort((left, right) => {
    if (left.source !== right.source) {
      if (left.source === "proxy") return -1;
      if (right.source === "proxy") return 1;
      return left.source === "custom" ? -1 : 1;
    }

    return left.id.localeCompare(right.id);
  });
}

function createProviderModelsCacheKey(apiBaseUrl: string, providerId: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}::${providerId}`;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}
