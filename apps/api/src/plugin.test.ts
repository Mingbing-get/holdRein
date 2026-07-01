import { join } from "node:path";

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFileSync: vi.fn(),
  realpathSync: vi.fn(),
  loadInstalledServerPlugins: vi.fn()
}));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();

  mocks.readFileSync.mockImplementation(actual.readFileSync);
  mocks.realpathSync.mockImplementation(actual.realpathSync);

  return {
    ...actual,
    readFileSync: mocks.readFileSync,
    realpathSync: mocks.realpathSync
  };
});

vi.mock("@hold-rein/plugin-server", () => ({
  createServerPluginRegistry: () => ({
    has: vi.fn(() => true),
    register: vi.fn()
  }),
  loadInstalledServerPlugins: mocks.loadInstalledServerPlugins
}));

const { bootstrapServerPlugins } = await import("./plugin");

beforeEach(async () => {
  mocks.readFileSync.mockReset();
  mocks.realpathSync.mockReset();
  mocks.loadInstalledServerPlugins.mockReset();
  mocks.readFileSync.mockImplementation(
    (await vi.importActual<typeof import("node:fs")>("node:fs")).readFileSync
  );
  mocks.realpathSync.mockImplementation(
    (await vi.importActual<typeof import("node:fs")>("node:fs")).realpathSync
  );
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

it("resolves shared plugin packages from the CLI runtime root", async () => {
  const packageName = "shared-runtime-package";
  const packageRoot = "/runtime-root/node_modules/shared-runtime-package";
  const pluginRoot = "/tmp/hold-rein-plugins";

  mocks.realpathSync.mockImplementation((path) => {
    if (path.toString().endsWith(join("apps", "node_modules", packageName))) {
      return packageRoot;
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });
  mocks.readFileSync.mockImplementation((path) => {
    if (path.toString() === join(packageRoot, "package.json")) {
      return JSON.stringify({ name: packageName });
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });

  await bootstrapServerPlugins(pluginRoot);

  const options = mocks.loadInstalledServerPlugins.mock.calls[0]?.[0];

  expect(options.resolvePackageTarget(packageName)).toBe(packageRoot);
});
