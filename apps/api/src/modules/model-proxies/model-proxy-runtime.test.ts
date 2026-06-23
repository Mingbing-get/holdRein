import type { Api, Model } from "@earendil-works/pi-ai";
import { describe, expect, it, vi } from "vitest";

import type { ModelProxiesService } from "./model-proxies-service";
import { createModelProxyRuntimeController } from "./model-proxy-runtime";

const realModel = (provider: string, id: string): Model<Api> =>
  ({
    api: "responses",
    baseUrl: "https://example.com/v1",
    contextWindow: 1000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id,
    input: ["text"],
    maxTokens: 1000,
    name: id,
    provider,
    reasoning: false
  }) as Model<Api>;

describe("model proxy runtime controller", () => {
  it("switches to the next candidate after pending usage exhausts the active candidate", async () => {
    const setModel = vi.fn();
    const service = {
      selectCandidate: vi
        .fn()
        .mockReturnValueOnce({ modelId: "gpt-4.1-mini", provider: "openai" })
    } as unknown as ModelProxiesService;
    const controller = createModelProxyRuntimeController({
      activeCandidate: { modelId: "gpt-4.1", provider: "openai" },
      proxyModelId: "coding-agent",
      resolveModel: async (_provider, modelId) => realModel("openai", modelId),
      service,
      setModel
    });

    await controller.recordAssistantUsage({
      inputToken: 700,
      modelId: "gpt-4.1",
      outputToken: 400,
      provider: "openai"
    });

    expect(service.selectCandidate).toHaveBeenCalledWith(
      "coding-agent",
      expect.objectContaining({
        "openai\u0000gpt-4.1": expect.objectContaining({ inputToken: 700 })
      })
    );
    expect(setModel).toHaveBeenCalledWith(
      expect.objectContaining({ id: "gpt-4.1-mini", provider: "openai" })
    );
  });

  it("raises an explicit error when no fallback candidate is available", async () => {
    const controller = createModelProxyRuntimeController({
      activeCandidate: { modelId: "gpt-4.1", provider: "openai" },
      proxyModelId: "coding-agent",
      resolveModel: async () => realModel("openai", "gpt-4.1"),
      service: {
        selectCandidate: vi.fn().mockReturnValue(null)
      } as unknown as ModelProxiesService,
      setModel: vi.fn()
    });

    await expect(
      controller.recordAssistantUsage({
        inputToken: 700,
        modelId: "gpt-4.1",
        outputToken: 400,
        provider: "openai"
      })
    ).rejects.toThrow("Proxy fallback unavailable");
  });
});
