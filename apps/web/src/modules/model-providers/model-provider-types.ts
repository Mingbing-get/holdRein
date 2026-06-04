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
  source: "builtin" | "custom";
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
