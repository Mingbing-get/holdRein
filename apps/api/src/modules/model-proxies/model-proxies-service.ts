import { randomUUID } from "node:crypto";

import type { ModelSummary, ModelProvidersService } from "../model-providers/model-providers-service";
import type {
  ModelProxyCandidateInput,
  ModelProxyDetails,
  ModelProxyInput,
  ModelProxyRequestInput,
  ModelProxyRepository,
  ModelProxyUsageRepository,
  ModelProxyWindowType
} from "./model-proxy-repository";

export interface PendingProxyUsage {
  inputToken: number;
  modelId: string;
  outputToken: number;
  provider: string;
}

export interface ModelProxiesService {
  createProxy: (input: ModelProxyRequestInput) => ModelProxyDetails;
  deleteProxy: (modelId: string) => boolean;
  findProxy: (modelId: string) => ModelProxyDetails | undefined;
  hasProxy: (modelId: string) => boolean;
  listProxies: () => ModelProxyDetails[];
  listProxyModels: () => ModelSummary[];
  selectCandidate: (
    modelId: string,
    pendingUsage?: Record<string, PendingProxyUsage>
  ) => ModelProxyCandidateInput | null;
  updateProxy: (modelId: string, input: ModelProxyRequestInput) => ModelProxyDetails | undefined;
}

export interface CreateModelProxiesServiceOptions {
  modelProvidersService: ModelProvidersService;
  now?: () => Date;
  repository: ModelProxyRepository;
  usageRepository: ModelProxyUsageRepository;
}

export function createModelProxiesService(
  options: CreateModelProxiesServiceOptions
): ModelProxiesService {
  const now = options.now ?? (() => new Date());

  const validate = (input: ModelProxyInput, existingModelId?: string) => {
    if (input.modelId.trim().length === 0 || input.name.trim().length === 0) {
      throw new Error("Proxy model id and name are required");
    }
    if (input.modelId !== existingModelId && options.repository.findProxyByModelId(input.modelId)) {
      throw new Error("Proxy model id already exists");
    }
    if (input.candidates.length === 0) throw new Error("Proxy requires candidates");
    for (const candidate of input.candidates) validateCandidate(candidate);
  };

  const validateCandidate = (candidate: ModelProxyCandidateInput) => {
    const configured = options.modelProvidersService.getConfiguredModelForProvider(
      candidate.provider,
      candidate.modelId
    );
    if (!configured) throw new Error("Unknown candidate provider or model");
    if (!configured.apiKey) throw new Error("Candidate provider has no API key");
    if (candidate.limits.length === 0) throw new Error("Candidate requires limits");
    for (const limit of candidate.limits) {
      if (!Number.isFinite(limit.maxTokens) || limit.maxTokens <= 0) {
        throw new Error("Token limits must be positive");
      }
      if (limit.windowType === "hours" && (!limit.windowHours || limit.windowHours <= 0)) {
        throw new Error("Hour windows require positive windowHours");
      }
    }
  };

  return {
    createProxy: (input) => {
      const normalized = normalizeProxyInput(input, allocateProxyModelId());
      validate(normalized);
      return options.repository.createProxy(normalized);
    },
    deleteProxy: options.repository.deleteProxy,
    findProxy: options.repository.findProxyByModelId,
    hasProxy: (modelId) => options.repository.findProxyByModelId(modelId) !== undefined,
    listProxies: options.repository.listProxies,
    listProxyModels: () =>
      options.repository.listProxies().map((proxy) => ({
        api: "responses",
        contextWindow: 0,
        id: proxy.modelId,
        input: ["text"],
        maxTokens: 0,
        name: proxy.name,
        provider: "local",
        reasoning: false
      })),
    selectCandidate: (modelId, pendingUsage = {}) => {
      const proxy = options.repository.findProxyByModelId(modelId);
      if (!proxy) throw new Error("Unknown proxy model");
      return proxy.candidates.find((candidate) =>
        candidate.limits.every((limit) =>
          hasCapacity(candidate, limit.windowType, limit.windowHours, limit.maxTokens, pendingUsage)
        )
      ) ?? null;
    },
    updateProxy: (modelId, input) => {
      const normalized = normalizeProxyInput(input);
      validate(normalized, modelId);
      return options.repository.updateProxy(modelId, normalized);
    }
  };

  function hasCapacity(
    candidate: { modelId: string; provider: string },
    windowType: ModelProxyWindowType,
    windowHours: number | null,
    maxTokens: number,
    pendingUsage: Record<string, PendingProxyUsage>
  ): boolean {
    const from = windowStart(windowType, windowHours).toISOString();
    const flushed = options.usageRepository
      .listModelTokenUsageSince(from)
      .filter((row) => row.provider === candidate.provider && row.modelName === candidate.modelId)
      .reduce((sum, row) => sum + row.inputToken + row.outputToken, 0);
    const pending = Object.values(pendingUsage)
      .filter((usage) => usage.provider === candidate.provider && usage.modelId === candidate.modelId)
      .reduce((sum, usage) => sum + usage.inputToken + usage.outputToken, 0);
    return flushed + pending < maxTokens;
  }

  function windowStart(type: ModelProxyWindowType, hours: number | null): Date {
    const current = now();
    if (type === "hours") return new Date(current.getTime() - (hours ?? 0) * 60 * 60 * 1000);
    const start = new Date(current);
    start.setUTCHours(0, 0, 0, 0);
    if (type === "week") start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    return start;
  }
}

function allocateProxyModelId(): string {
  return `local-${randomUUID()}`;
}

function normalizeProxyInput(
  input: ModelProxyRequestInput,
  fallbackModelId?: string
): ModelProxyInput {
  return {
    candidates: input.candidates
      .map((candidate) => ({
        limits: candidate.limits.map((limit) => ({
          maxTokens: limit.maxTokens,
          ...(limit.windowHours === undefined ? {} : { windowHours: limit.windowHours }),
          windowType: limit.windowType
        })),
        modelId: candidate.modelId.trim(),
        priority: candidate.priority,
        provider: candidate.provider.trim()
      }))
      .sort((left, right) => left.priority - right.priority),
    modelId: (input.modelId ?? fallbackModelId ?? "").trim(),
    name: input.name.trim()
  };
}
