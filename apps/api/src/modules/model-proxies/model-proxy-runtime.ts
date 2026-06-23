import type { Api, Model } from "@earendil-works/pi-ai";

import type { ModelProxiesService, PendingProxyUsage } from "./model-proxies-service";

export interface ModelProxyRuntimeCandidate {
  modelId: string;
  provider: string;
}

export interface ModelProxyRuntimeController {
  getActiveModel: () => Model<Api>;
  recordAssistantUsage: (usage: PendingProxyUsage) => Promise<void>;
}

export interface CreateModelProxyRuntimeControllerOptions {
  activeCandidate: ModelProxyRuntimeCandidate;
  activeModel?: Model<Api>;
  proxyModelId: string;
  resolveModel: (provider: string, modelId: string) => Promise<Model<Api> | null>;
  service: ModelProxiesService;
  setModel: (model: Model<Api>) => Promise<void> | void;
}

export function createModelProxyRuntimeController(
  options: CreateModelProxyRuntimeControllerOptions
): ModelProxyRuntimeController {
  let activeCandidate = options.activeCandidate;
  let activeModel = options.activeModel;
  const pendingUsage = new Map<string, PendingProxyUsage>();

  return {
    getActiveModel: () => {
      if (!activeModel) {
        throw new Error("Proxy active model is not initialized");
      }
      return activeModel;
    },
    recordAssistantUsage: async (usage) => {
      if (
        usage.provider !== activeCandidate.provider ||
        usage.modelId !== activeCandidate.modelId
      ) {
        return;
      }

      const key = usageKey(usage.provider, usage.modelId);
      const existing = pendingUsage.get(key);
      pendingUsage.set(key, {
        inputToken: (existing?.inputToken ?? 0) + usage.inputToken,
        modelId: usage.modelId,
        outputToken: (existing?.outputToken ?? 0) + usage.outputToken,
        provider: usage.provider
      });

      const nextCandidate = options.service.selectCandidate(
        options.proxyModelId,
        Object.fromEntries(pendingUsage)
      );
      if (!nextCandidate) {
        throw new Error("Proxy fallback unavailable");
      }
      if (
        nextCandidate.provider === activeCandidate.provider &&
        nextCandidate.modelId === activeCandidate.modelId
      ) {
        return;
      }

      const nextModel = await options.resolveModel(
        nextCandidate.provider,
        nextCandidate.modelId
      );
      if (!nextModel) {
        throw new Error("Unknown candidate provider or model");
      }
      activeCandidate = nextCandidate;
      activeModel = nextModel;
      await options.setModel(nextModel);
    }
  };
}

function usageKey(provider: string, modelId: string): string {
  return `${provider}\0${modelId}`;
}
