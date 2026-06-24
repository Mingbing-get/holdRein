import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchCachedProviderModels,
  invalidateProviderModelsCache
} from "./model-provider-api";

const fetchMock = vi.fn<typeof fetch>();

describe("model provider API cache", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    invalidateProviderModelsCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateProviderModelsCache();
  });

  it("caches provider models until the provider cache is invalidated", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "chat",
              contextWindow: 128000,
              id: "coding-agent",
              input: ["text"],
              maxTokens: 4096,
              name: "Coding Agent",
              provider: "local",
              reasoning: false
            }
          ],
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: [
            {
              api: "chat",
              contextWindow: 128000,
              id: "coding-agent",
              input: ["text"],
              maxTokens: 4096,
              name: "Coding Agent Updated",
              provider: "local",
              reasoning: false
            }
          ],
          msg: "ok"
        }),
        ok: true
      } as Response);

    await expect(
      fetchCachedProviderModels("http://localhost:4000", "local")
    ).resolves.toEqual([
      expect.objectContaining({ name: "Coding Agent" })
    ]);
    await expect(
      fetchCachedProviderModels("http://localhost:4000", "local")
    ).resolves.toEqual([
      expect.objectContaining({ name: "Coding Agent" })
    ]);

    invalidateProviderModelsCache("http://localhost:4000", "local");

    await expect(
      fetchCachedProviderModels("http://localhost:4000", "local")
    ).resolves.toEqual([
      expect.objectContaining({ name: "Coding Agent Updated" })
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
