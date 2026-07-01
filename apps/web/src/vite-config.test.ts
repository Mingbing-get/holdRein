import { describe, expect, it } from "vitest";

describe("web vite config", () => {
  it("loads without unsupported vite subpath imports", async () => {
    const configModulePath = new URL("../vite.config.ts", import.meta.url).href;

    await expect(import(configModulePath)).resolves.toHaveProperty("default");
  });

  it("proxies /api requests to the default backend server", async () => {
    const configModulePath = new URL("../vite.config.ts", import.meta.url).href;
    const { default: viteConfig } = await import(configModulePath);
    const resolvedConfig =
      typeof viteConfig === "function"
        ? await viteConfig({ command: "serve", isSsrBuild: false, mode: "test" })
        : viteConfig;

    expect(resolvedConfig.server?.proxy).toMatchObject({
      "/api": {
        changeOrigin: true,
        proxyTimeout: 600_000,
        target: "http://localhost:3001"
      }
    });
  });

  it("keeps dev proxy connections open for long-running plugin installs", async () => {
    const configModulePath = new URL("../vite.config.ts", import.meta.url).href;
    const { default: viteConfig } = await import(configModulePath);
    const resolvedConfig =
      typeof viteConfig === "function"
        ? await viteConfig({ command: "serve", isSsrBuild: false, mode: "test" })
        : viteConfig;

    expect(resolvedConfig.server?.proxy).toMatchObject({
      "/api": {
        proxyTimeout: 600_000,
        timeout: 600_000
      },
      "/plugin": {
        proxyTimeout: 600_000,
        timeout: 600_000
      }
    });
  });
});
