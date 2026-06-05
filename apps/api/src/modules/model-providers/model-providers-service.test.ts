import { describe, expect, it } from "vitest";

import { createInMemoryModelProviderRepository } from "./model-provider-repository";
import { createModelProvidersService } from "./model-providers-service";

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");

describe("model providers service", () => {
  it("deletes a custom provider along with its models and api key", () => {
    const repository = createInMemoryModelProviderRepository();
    const service = createModelProvidersService({
      providerApiKeyEncryptionKey: TEST_ENCRYPTION_KEY,
      repository
    });

    const customProvider = service.createCustomModelProvider(
      "acme-ai",
      "https://example.com/v1"
    );

    service.createCustomProviderModel("acme-ai", {
      api: "responses",
      contextWindow: 32000,
      input: ["text"],
      maxTokens: 4096,
      modelId: "acme-chat",
      name: "Acme Chat",
      reasoning: false
    });
    service.storeProviderApiKey("acme-ai", "test-acme-key");

    expect(service.deleteCustomModelProvider("acme-ai")).toBe(true);
    expect(service.hasProvider("acme-ai")).toBe(false);
    expect(service.listModelsForProvider("acme-ai")).toEqual([]);
    expect(repository.findProviderApiKeyByProvider("acme-ai")).toBeUndefined();
    expect(
      repository.listCustomProviderModelsByProviderId(customProvider.id)
    ).toEqual([]);
    expect(repository.findCustomModelProviderByProvider("acme-ai")).toBeUndefined();
  });
});
