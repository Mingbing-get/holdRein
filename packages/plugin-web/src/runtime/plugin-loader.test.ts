import { expect, it, vi } from "vitest";

import { loadRuntimeWebPlugins } from "./plugin-loader";

it("imports and registers web plugins", async () => {
  const register = vi.fn();

  await loadRuntimeWebPlugins({
    importer: vi.fn(async () => ({ id: "demo" })),
    manifests: [
      {
        id: "demo",
        name: "Demo",
        packageName: "@scope/demo",
        version: "1.0.0",
        webEntry: "/demo.js"
      }
    ],
    registry: { has: () => false, register }
  });

  expect(register).toHaveBeenCalledWith({ id: "demo" });
});
