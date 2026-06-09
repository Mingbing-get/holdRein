import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Api, Model } from "@earendil-works/pi-ai";

const complete = vi.fn();

vi.mock("@earendil-works/pi-ai", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  complete
}));

const { createDefaultTaskTitleGenerator } = await import(
  "./agent-task-title-generator"
);

const customModel: Model<Api> = {
  api: "openai-completions",
  baseUrl: "https://example.com/v1",
  contextWindow: 32000,
  cost: {
    cacheRead: 0,
    cacheWrite: 0,
    input: 0,
    output: 0
  },
  id: "acme-chat",
  input: ["text"],
  maxTokens: 4096,
  name: "Acme Chat",
  provider: "acme-ai",
  reasoning: false
};

describe("default task title generator", () => {
  beforeEach(() => {
    complete.mockReset();
  });

  it("generates a title with a custom model after built-in lookup misses", async () => {
    complete.mockResolvedValue({
      content: [{ text: "Inspect custom provider", type: "text" }]
    });
    const getCustomModel = vi.fn().mockResolvedValue(customModel);
    const generator = createDefaultTaskTitleGenerator({ getCustomModel });

    await expect(
      generator.generateTitle({
        apiKey: "test-api-key",
        modelId: "acme-chat",
        prompt: "Inspect the custom provider configuration",
        provider: "acme-ai"
      })
    ).resolves.toBe("Inspect custom provider");

    expect(getCustomModel).toHaveBeenCalledWith("acme-ai", "acme-chat");
    expect(complete).toHaveBeenCalledWith(
      customModel,
      expect.any(Object),
      expect.objectContaining({ apiKey: "test-api-key" })
    );
  });
});
