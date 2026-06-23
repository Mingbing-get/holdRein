import { describe, expect, it } from "vitest";

import type { ModelTokenUsageHourlyRow } from "../../db";
import { createInMemoryModelProviderRepository } from "../model-providers/model-provider-repository";
import { createModelProvidersService } from "../model-providers/model-providers-service";
import {
  createInMemoryModelProxyRepository,
  type ModelProxyUsageRepository
} from "./model-proxy-repository";
import { createModelProxiesService } from "./model-proxies-service";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");

function createFixture(seedUsage: ModelTokenUsageHourlyRow[] = []) {
  const providerRepository = createInMemoryModelProviderRepository();
  const modelProvidersService = createModelProvidersService({
    providerApiKeyEncryptionKey: TEST_ENCRYPTION_KEY,
    repository: providerRepository
  });
  const proxyRepository = createInMemoryModelProxyRepository();
  const usageRepository: ModelProxyUsageRepository = {
    listModelTokenUsageSince: () => seedUsage
  };

  return {
    modelProvidersService,
    service: createModelProxiesService({
      modelProvidersService,
      now: () => new Date("2026-06-23T12:30:00.000Z"),
      repository: proxyRepository,
      usageRepository
    })
  };
}

describe("model proxies service", () => {
  it("creates a proxy with ordered candidates and limits", () => {
    const { modelProvidersService, service } = createFixture();
    modelProvidersService.storeProviderApiKey("openai", "test-key");

    const proxy = service.createProxy({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "hours", windowHours: 24 }],
          modelId: "gpt-4.1",
          priority: 2,
          provider: "openai"
        }
      ],
      modelId: "coding-agent",
      name: "Coding Agent"
    });

    expect(proxy).toEqual(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            limits: [expect.objectContaining({ maxTokens: 1000 })],
            modelId: "gpt-4.1",
            priority: 2,
            provider: "openai"
          })
        ],
        modelId: "coding-agent",
        name: "Coding Agent"
      })
    );
    expect(service.listProxyModels()).toEqual([
      expect.objectContaining({ id: "coding-agent", provider: "local" })
    ]);
  });

  it("rejects duplicate proxy ids and providers without api keys", () => {
    const { service } = createFixture();

    expect(() =>
      service.createProxy({
        candidates: [
          {
            limits: [{ maxTokens: 1000, windowType: "day" }],
            modelId: "gpt-4.1",
            priority: 1,
            provider: "openai"
          }
        ],
        modelId: "coding-agent",
        name: "Coding Agent"
      })
    ).toThrow("Candidate provider has no API key");
  });

  it("selects the first candidate with remaining token capacity", () => {
    const { modelProvidersService, service } = createFixture([
      {
        hour: "2026-06-23T12:00:00.000Z",
        inputToken: 700,
        modelName: "gpt-4.1",
        outputToken: 400,
        provider: "openai"
      }
    ]);
    modelProvidersService.storeProviderApiKey("openai", "test-key");
    service.createProxy({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "hours", windowHours: 24 }],
          modelId: "gpt-4.1",
          priority: 1,
          provider: "openai"
        },
        {
          limits: [{ maxTokens: 1000, windowType: "day" }],
          modelId: "gpt-4.1-mini",
          priority: 2,
          provider: "openai"
        }
      ],
      modelId: "coding-agent",
      name: "Coding Agent"
    });

    expect(service.selectCandidate("coding-agent")).toEqual(
      expect.objectContaining({
        modelId: "gpt-4.1-mini",
        provider: "openai"
      })
    );
  });

  it("includes pending usage when evaluating fallback capacity", () => {
    const { modelProvidersService, service } = createFixture();
    modelProvidersService.storeProviderApiKey("openai", "test-key");
    service.createProxy({
      candidates: [
        {
          limits: [{ maxTokens: 1000, windowType: "week" }],
          modelId: "gpt-4.1",
          priority: 1,
          provider: "openai"
        },
        {
          limits: [{ maxTokens: 1000, windowType: "week" }],
          modelId: "gpt-4.1-mini",
          priority: 2,
          provider: "openai"
        }
      ],
      modelId: "coding-agent",
      name: "Coding Agent"
    });

    expect(
      service.selectCandidate("coding-agent", {
        gpt: {
          inputToken: 700,
          modelId: "gpt-4.1",
          outputToken: 400,
          provider: "openai"
        }
      })
    ).toEqual(expect.objectContaining({ modelId: "gpt-4.1-mini" }));
  });
});
