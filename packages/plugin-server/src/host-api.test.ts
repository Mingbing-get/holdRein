import { describe, expect, it, vi } from "vitest";

import { createLoopbackHostApiClient } from "./host-api";

describe("createLoopbackHostApiClient", () => {
  it("requests host API paths against the configured base URL", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: { ok: true }, msg: "success" }))
    );
    const hostApi = createLoopbackHostApiClient({
      baseUrl: "http://127.0.0.1:3001/",
      fetch
    });

    const result = await hostApi.request({
      body: { provider: "local" },
      method: "POST",
      path: "/api/v1/model-providers",
      query: {
        empty: undefined,
        enabled: true,
        page: 2,
        search: "gpt 4"
      }
    });

    expect(result).toEqual({ code: 0, data: { ok: true }, msg: "success" });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/api/v1/model-providers?empty=&enabled=true&page=2&search=gpt+4",
      expect.objectContaining({
        body: JSON.stringify({ provider: "local" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
        signal: expect.any(Object)
      })
    );
  });

  it("rejects paths that are not host API paths", async () => {
    const hostApi = createLoopbackHostApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetch: vi.fn()
    });

    await expect(
      hostApi.request({ path: "https://example.com/api/v1/model-providers" })
    ).rejects.toThrow("path must begin with /api/v1 and must not include a host.");
  });
});
