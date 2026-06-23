export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export interface ModelProviderSummary {
  baseUrl?: string;
  hasApiKey: boolean;
  id: string;
  modelCount: number;
  source: "builtin" | "custom" | "proxy";
}

export interface ModelSummary {
  api: string;
  contextWindow: number;
  id: string;
  input: string[];
  maxTokens: number;
  name: string;
  provider: string;
  reasoning: boolean;
}

export type ModelProxyWindowType = "hours" | "day" | "week";

export interface ModelProxyLimit {
  id?: string;
  maxTokens: number;
  windowHours?: number | null;
  windowType: ModelProxyWindowType;
}

export interface ModelProxyCandidate {
  id?: string;
  limits: ModelProxyLimit[];
  modelId: string;
  priority: number;
  provider: string;
}

export interface ModelProxySummary {
  candidates: ModelProxyCandidate[];
  createdAt?: string;
  id?: string;
  modelId: string;
  name: string;
  updatedAt?: string;
}
