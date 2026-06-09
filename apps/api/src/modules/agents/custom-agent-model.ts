import type { Api, Model } from "@earendil-works/pi-ai";

export interface CustomAgentModelConfig {
  baseUrl: string;
  model: {
    api: string;
    contextWindow: number;
    id: string;
    input: string[];
    maxTokens: number;
    name: string;
    provider: string;
    reasoning: boolean;
  };
}

export function toCustomAgentModel(configured: CustomAgentModelConfig): Model<Api> {
  return {
    ...configured.model,
    api: configured.model.api as Api,
    baseUrl: configured.baseUrl,
    ...(configured.model.api === "openai-completions"
      ? {
          compat: {
            supportsDeveloperRole: false
          }
        }
      : {}),
    cost: {
      cacheRead: 0,
      cacheWrite: 0,
      input: 0,
      output: 0
    },
    input: configured.model.input.filter(
      (input): input is "text" | "image" => input === "text" || input === "image"
    )
  };
}
