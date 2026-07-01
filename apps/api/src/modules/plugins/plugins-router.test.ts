import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createPluginsRouter } from "./plugins-router";
import type { PluginsService } from "./plugins-types";

describe("plugins router", () => {
  it("returns runtime plugin config", async () => {
    const app = express();

    app.use(
      "/api/v1/plugins",
      createPluginsRouter({
        pluginsService: createPluginsServiceMock({
          listPlugins: async () => [
            {
              disabled: false,
              id: "demo",
              name: "Demo",
              packageName: "@scope/demo",
              version: "1.0.0",
              webEntry: "/plugin-assets/demo.js"
            }
          ]
        })
      })
    );

    const response = await request(app).get("/api/v1/plugins");

    expect(response.status).toBe(200);
    expect(response.body.data.plugins[0].webEntry).toBe(
      "/plugin-assets/demo.js"
    );
  });

  it("updates disabled state, installs plugins, and uninstalls plugins", async () => {
    const app = express();
    const service = createPluginsServiceMock({
      installPlugin: vi.fn(async () => ({
        disabled: false,
        id: "@scope/review",
        name: "@scope/review",
        packageName: "@scope/review",
        version: "1.0.0",
        webEntry: "/plugin-assets/review/web.js"
      })),
      setPluginDisabled: vi.fn(async () => ({
        disabled: true,
        id: "@scope/demo",
        name: "@scope/demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/plugin-assets/demo/web.js"
      })),
      uninstallPlugin: vi.fn(async () => true)
    });

    app.use(express.json());
    app.use("/api/v1/plugins", createPluginsRouter({ pluginsService: service }));

    const updateResponse = await request(app)
      .patch("/api/v1/plugins/%40scope%2Fdemo")
      .send({ disabled: true });
    const installResponse = await request(app)
      .post("/api/v1/plugins/install")
      .send({ source: "@scope/review", sourceType: "npm" });
    const uninstallResponse = await request(app).delete(
      "/api/v1/plugins/%40scope%2Fdemo"
    );

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.disabled).toBe(true);
    expect(service.setPluginDisabled).toHaveBeenCalledWith("@scope/demo", true);
    expect(installResponse.status).toBe(200);
    expect(service.installPlugin).toHaveBeenCalledWith({
      source: "@scope/review",
      sourceType: "npm"
    });
    expect(uninstallResponse.status).toBe(200);
    expect(uninstallResponse.body.data).toEqual({ id: "@scope/demo" });
    expect(service.uninstallPlugin).toHaveBeenCalledWith("@scope/demo");
  });
});

function createPluginsServiceMock(
  overrides: Partial<PluginsService>
): PluginsService {
  return {
    installPlugin: async () => {
      throw new Error("not implemented");
    },
    listDisabledPluginIds: async () => [],
    listPlugins: async () => [],
    setPluginDisabled: async () => null,
    uninstallPlugin: async () => false,
    ...overrides
  };
}
