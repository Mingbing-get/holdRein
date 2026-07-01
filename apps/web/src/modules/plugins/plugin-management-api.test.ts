import { describe, expect, it, vi } from "vitest";

import {
  createPluginInstallUrl,
  createPluginUrl,
  fetchInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  setPluginDisabled
} from "./plugin-management-api";

const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", fetchMock);

describe("plugin management api", () => {
  it("builds plugin urls", () => {
    expect(createPluginUrl("http://localhost:4000/", "demo plugin")).toBe(
      "http://localhost:4000/api/v1/plugins/demo%20plugin"
    );
    expect(createPluginInstallUrl("http://localhost:4000")).toBe(
      "http://localhost:4000/api/v1/plugins/install"
    );
  });

  it("loads and mutates plugins", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            plugins: [
              {
                disabled: false,
                id: "demo",
                name: "Demo",
                packageName: "@scope/demo",
                version: "1.0.0",
                webEntry: "/plugin-assets/demo/web.js"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            disabled: true,
            id: "demo",
            name: "Demo",
            packageName: "@scope/demo",
            version: "1.0.0",
            webEntry: "/plugin-assets/demo/web.js"
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            disabled: false,
            id: "local",
            name: "Local",
            packageName: "local-plugin",
            version: "1.0.0",
            webEntry: "/plugin-assets/local/web.js"
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { id: "demo" },
          msg: "ok"
        }),
        ok: true
      } as Response);

    await expect(fetchInstalledPlugins("http://localhost:4000")).resolves.toEqual([
      expect.objectContaining({ id: "demo", name: "Demo" })
    ]);
    await setPluginDisabled("http://localhost:4000", "demo", true);
    await installPlugin("http://localhost:4000", {
      source: "/Users/me/local-plugin",
      sourceType: "local"
    });
    await uninstallPlugin("http://localhost:4000", "demo");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/plugins"
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/plugins/demo",
      {
        body: JSON.stringify({ disabled: true }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/plugins/install",
      {
        body: JSON.stringify({
          source: "/Users/me/local-plugin",
          sourceType: "local"
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      }
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/plugins/demo",
      { method: "DELETE" }
    );
  });
});
