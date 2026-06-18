import { describe, expect, it, vi } from "vitest";

import type { Api, Model } from "@earendil-works/pi-ai";

import { resolveAgentModel } from "./resolver";

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

describe("agent model resolver", () => {
  it("uses a built-in model without querying custom models", async () => {
    const getCustomModel = vi.fn();

    const model = await resolveAgentModel("openai", "gpt-4.1", getCustomModel);

    expect(model).toEqual(expect.objectContaining({ id: "gpt-4.1" }));
    expect(getCustomModel).not.toHaveBeenCalled();
  });

  it("queries custom models after the built-in registry misses", async () => {
    const getCustomModel = vi.fn().mockResolvedValue(customModel);

    await expect(
      resolveAgentModel("acme-ai", "acme-chat", getCustomModel)
    ).resolves.toBe(customModel);
    expect(getCustomModel).toHaveBeenCalledWith("acme-ai", "acme-chat");
  });

  it("returns null when neither built-in nor custom models exist", async () => {
    const getCustomModel = vi.fn().mockResolvedValue(null);

    await expect(
      resolveAgentModel("missing-provider", "missing-model", getCustomModel)
    ).resolves.toBeNull();
  });
});
