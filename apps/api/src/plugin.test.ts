import { join } from "node:path";

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadInstalledServerPlugins: vi.fn()
}));

vi.mock("@hold-rein/plugin-server", () => ({
  createServerPluginRegistry: () => ({
    has: vi.fn(() => true),
    register: vi.fn()
  }),
  loadInstalledServerPlugins: mocks.loadInstalledServerPlugins
}));

const { bootstrapServerPlugins } = await import("./plugin");

beforeEach(() => {
  mocks.loadInstalledServerPlugins.mockReset();
  mocks.loadInstalledServerPlugins.mockResolvedValue({
    plugins: [],
    webPlugins: []
  });
});

it("resolves shared plugin packages from the API runtime module", async () => {
  const pluginRoot = "/tmp/hold-rein-plugins";

  await bootstrapServerPlugins(pluginRoot);

  const options = mocks.loadInstalledServerPlugins.mock.calls[0]?.[0];

  expect(options).toMatchObject({
    hostNodeModules: join(process.cwd(), "node_modules"),
    pluginRoot
  });
  expect(options.resolvePackageTarget("express")).toContain(
    `${join("node_modules", "express")}`
  );
  expect(options.resolvePackageTarget("@earendil-works/pi-agent-core")).toContain(
    `${join("node_modules", "@earendil-works", "pi-agent-core")}`
  );
  expect(options.resolvePackageTarget("@earendil-works/pi-ai")).toContain(
    `${join("node_modules", "@earendil-works", "pi-ai")}`
  );
});
