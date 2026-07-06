import { join } from "node:path";
import {
  readFileSync as nodeReadFileSync,
  realpathSync as nodeRealpathSync
} from "node:fs";

import express, { Router } from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import type {
  DevPluginManager,
  DevServerPluginEntry
} from "@hold-rein/plugin-server";

const mocks = vi.hoisted(() => ({
  installPluginPackage: vi.fn(),
  readFileSync: vi.fn(),
  realpathSync: vi.fn(),
  loadInstalledServerPlugins: vi.fn(),
  replaceAll: vi.fn(),
  registerRoutes: vi.fn()
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
    replaceAll: mocks.replaceAll,
    registerRoutes: mocks.registerRoutes
  }),
  installPluginPackage: mocks.installPluginPackage,
  loadInstalledServerPlugins: mocks.loadInstalledServerPlugins
}));

const {
  bootstrapServerPlugins,
  clearRuntimePluginsForTests,
  createRuntimePluginRequestHandler,
  reloadServerPlugins
} = await import("./plugin");

beforeEach(async () => {
  clearRuntimePluginsForTests();
  mocks.installPluginPackage.mockReset();
  mocks.readFileSync.mockReset();
  mocks.realpathSync.mockReset();
  mocks.loadInstalledServerPlugins.mockReset();
  mocks.replaceAll.mockReset();
  mocks.registerRoutes.mockReset();
  mocks.readFileSync.mockImplementation(nodeReadFileSync);
  mocks.realpathSync.mockImplementation(nodeRealpathSync);
  mocks.loadInstalledServerPlugins.mockResolvedValue({
    plugins: [],
    webPlugins: []
  });
  mocks.registerRoutes.mockResolvedValue(undefined);
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

it("disposes replaced development plugin instances before registry replacement", async () => {
  const firstDispose = vi.fn();
  const firstPlugin = { dispose: firstDispose, id: "demo" };
  const secondPlugin = { id: "demo" };
  const devEntry: DevServerPluginEntry = {
    entryPath: "/tmp/plugin/src/server.ts",
    manifest: {
      dev: true,
      id: "demo",
      name: "Demo",
      packageName: "@scope/demo",
      version: "0.0.0",
      webEntry: "http://127.0.0.1:5178/src/web.ts",
      webEntryType: "module"
    },
    packageDirectory: "/tmp/plugin"
  };
  const devPluginManager: DevPluginManager = {
    close: vi.fn(),
    getServerPluginEntries: vi.fn(() => [devEntry]),
    getWebPluginManifests: vi.fn(() => [])
  };
  const importDevModule = vi
    .fn()
    .mockResolvedValueOnce({ default: firstPlugin })
    .mockResolvedValueOnce({ default: secondPlugin });

  await reloadServerPlugins("/tmp/plugins", { devPluginManager, importDevModule });
  await reloadServerPlugins("/tmp/plugins", { devPluginManager, importDevModule });

  expect(firstDispose).toHaveBeenCalledOnce();
  expect(mocks.replaceAll).toHaveBeenLastCalledWith([
    { id: "demo", packageName: "@scope/demo" }
  ]);
  expect(importDevModule.mock.calls[1]?.[0]).toContain("holdReinReload=2");
});

it("rebuilds the stable plugin request handler with replacement routes", async () => {
  const app = express();
  const context = {} as Parameters<typeof createRuntimePluginRequestHandler>[0];
  const oldRouter = Router();
  oldRouter.get("/value", (_request, response) => response.send("old"));
  const newRouter = Router();
  newRouter.get("/value", (_request, response) => response.send("new"));

  mocks.registerRoutes.mockImplementationOnce(async (router) => {
    router.use("/demo", oldRouter);
  });
  app.use("/plugin", await createRuntimePluginRequestHandler(context));

  mocks.registerRoutes.mockImplementationOnce(async (router) => {
    router.use("/demo", newRouter);
  });
  await reloadServerPlugins("/tmp/plugins");

  const response = await request(app).get("/plugin/demo/value");

  expect(response.text).toBe("new");
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
