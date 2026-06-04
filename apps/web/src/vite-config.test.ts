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
        target: "http://localhost:3001"
      }
    });
  });
});
