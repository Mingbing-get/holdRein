import { join } from "node:path";
import {
  readFileSync as nodeReadFileSync,
  realpathSync as nodeRealpathSync
} from "node:fs";

import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  installPluginPackage: vi.fn(),
  readFileSync: vi.fn(),
  realpathSync: vi.fn(),
  loadInstalledServerPlugins: vi.fn(),
  replaceAll: vi.fn()
}));

type NodeFsMockModule = {
  readFileSync: typeof nodeReadFileSync;
  realpathSync: typeof nodeRealpathSync;
} & Record<string, unknown>;

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as NodeFsMockModule;

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
    register: vi.fn(),
    replaceAll: mocks.replaceAll
  }),
  installPluginPackage: mocks.installPluginPackage,
  loadInstalledServerPlugins: mocks.loadInstalledServerPlugins
}));

const { bootstrapServerPlugins, reloadServerPlugins } = await import("./plugin");

beforeEach(async () => {
  mocks.installPluginPackage.mockReset();
  mocks.readFileSync.mockReset();
  mocks.realpathSync.mockReset();
  mocks.loadInstalledServerPlugins.mockReset();
  mocks.replaceAll.mockReset();
  mocks.readFileSync.mockImplementation(nodeReadFileSync);
  mocks.realpathSync.mockImplementation(nodeRealpathSync);
  mocks.loadInstalledServerPlugins.mockResolvedValue({
    plugins: [],
    webPlugins: []
  });
});

it("replaces the active server plugins when plugins are reloaded", async () => {
  const pluginRoot = "/tmp/hold-rein-plugins";
  const plugins = [{ id: "enabled-plugin" }];

  mocks.loadInstalledServerPlugins.mockResolvedValueOnce({
    plugins,
    webPlugins: []
  });

  await reloadServerPlugins(pluginRoot);

  expect(mocks.replaceAll).toHaveBeenCalledWith(plugins);
});

it("resolves shared plugin packages from the API runtime module", async () => {
  const pluginRoot = "/tmp/hold-rein-plugins";
  const expressRoot = mockRuntimePackage("express");
  const agentCoreRoot = mockRuntimePackage("@earendil-works/pi-agent-core");
  const piAiRoot = mockRuntimePackage("@earendil-works/pi-ai");

  await bootstrapServerPlugins(pluginRoot);

  const options = mocks.loadInstalledServerPlugins.mock.calls[0]?.[0];

  expect(options).toMatchObject({
    disabledPluginIds: [],
    hostNodeModules: join(process.cwd(), "node_modules"),
    pluginRoot
  });
  expect(options.resolvePackageTarget("express")).toBe(expressRoot);
  expect(options.resolvePackageTarget("@earendil-works/pi-agent-core")).toBe(
    agentCoreRoot
  );
  expect(options.resolvePackageTarget("@earendil-works/pi-ai")).toBe(piAiRoot);
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

function mockRuntimePackage(packageName: string): string {
  const packageRoot = join(
    "/runtime-root",
    "node_modules",
    ...packageName.split("/")
  );
  const previousRealpathSync = mocks.realpathSync.getMockImplementation();
  const previousReadFileSync = mocks.readFileSync.getMockImplementation();

  mocks.realpathSync.mockImplementation((path) => {
    if (path.toString().endsWith(join("node_modules", ...packageName.split("/")))) {
      return packageRoot;
    }

    if (previousRealpathSync) {
      return previousRealpathSync(path);
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });
  mocks.readFileSync.mockImplementation((path) => {
    if (path.toString() === join(packageRoot, "package.json")) {
      return JSON.stringify({ name: packageName });
    }

    if (previousReadFileSync) {
      return previousReadFileSync(path);
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });

  return packageRoot;
}
