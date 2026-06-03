import { describe, expect, it } from "vitest";

describe("web vite config", () => {
  it("loads without unsupported vite subpath imports", async () => {
    const configModulePath = new URL("../vite.config.ts", import.meta.url).href;

    await expect(import(configModulePath)).resolves.toHaveProperty("default");
  });
});
