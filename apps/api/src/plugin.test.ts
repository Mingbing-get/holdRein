import { join } from "node:path";

import express, { Router } from "express";
import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import type {
  DevPluginManager,
  DevServerPluginEntry
} from "@hold-rein/plugin-server";

const mocks = vi.hoisted(() => ({
  createLoopbackHostApiFactory: vi.fn(),
  installPluginPackage: vi.fn(),
  realpathSync: vi.fn(),
  loadInstalledServerPlugins: vi.fn(),
  replaceAll: vi.fn(),
  registerRoutes: vi.fn()
}));
const DEFAULT_RUNTIME_NODE_MODULES = "/runtime-root/node_modules";

type NodeFsMockModule = typeof import("node:fs") & Record<string, unknown>;

vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as NodeFsMockModule;

  return {
    ...actual,
    realpathSync: mocks.realpathSync
  };
});

vi.mock("@hold-rein/plugin-server", () => ({
  createLoopbackHostApiFactory: mocks.createLoopbackHostApiFactory,
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
  mocks.createLoopbackHostApiFactory.mockReset();
  mocks.installPluginPackage.mockReset();
  mocks.realpathSync.mockReset();
  mocks.loadInstalledServerPlugins.mockReset();
  mocks.replaceAll.mockReset();
  mocks.registerRoutes.mockReset();
  mocks.realpathSync.mockImplementation(resolveDefaultRuntimeNodeModules);
  mocks.loadInstalledServerPlugins.mockResolvedValue({
    plugins: [],
    webPlugins: []
  });
  mocks.registerRoutes.mockResolvedValue(undefined);
  mocks.createLoopbackHostApiFactory.mockReturnValue(() => ({
    request: vi.fn()
  }));
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

it("calls plugin loaded hooks with plugin-scoped host APIs", async () => {
  const onLoaded = vi.fn();
  const hostApi = { agent: { start: vi.fn() } };
  const hostApiFactory = vi.fn(() => hostApi);
  const plugin = {
    id: "enabled-plugin",
    packageName: "@scope/enabled-plugin",
    onLoaded
  };

  mocks.createLoopbackHostApiFactory.mockReturnValueOnce(hostApiFactory);
  mocks.loadInstalledServerPlugins.mockResolvedValueOnce({
    plugins: [plugin],
    webPlugins: []
  });

  await reloadServerPlugins("/tmp/plugins", {
    hostApiBaseUrl: "http://127.0.0.1:3001"
  });

  expect(mocks.createLoopbackHostApiFactory).toHaveBeenCalledWith({
    baseUrl: "http://127.0.0.1:3001"
  });
  expect(hostApiFactory).toHaveBeenCalledWith({
    id: "enabled-plugin",
    packageName: "@scope/enabled-plugin"
  });
  expect(onLoaded).toHaveBeenCalledWith({ hostApi });
});

it("resolves host node_modules from the API runtime module", async () => {
  const pluginRoot = "/tmp/hold-rein-plugins";
  const runtimeNodeModules = mockRuntimeNodeModules();

  await bootstrapServerPlugins(pluginRoot);

  const options = mocks.loadInstalledServerPlugins.mock.calls[0]?.[0];

  expect(options).toMatchObject({
    disabledPluginIds: [],
    hostNodeModules: runtimeNodeModules,
    pluginRoot
  });
  expect(options.resolvePackageTarget).toBeUndefined();
});

it("resolves host node_modules from the CLI runtime root", async () => {
  const pluginRoot = "/tmp/hold-rein-plugins";
  const runtimeNodeModules = "/runtime-root/node_modules";

  mocks.realpathSync.mockImplementation((path) => {
    if (path.toString().endsWith(join("apps", "node_modules"))) {
      return runtimeNodeModules;
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });

  await bootstrapServerPlugins(pluginRoot);

  const options = mocks.loadInstalledServerPlugins.mock.calls[0]?.[0];

  expect(options.hostNodeModules).toBe(runtimeNodeModules);
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

function mockRuntimeNodeModules(): string {
  const runtimeNodeModules = DEFAULT_RUNTIME_NODE_MODULES;
  const previousRealpathSync = mocks.realpathSync.getMockImplementation();

  mocks.realpathSync.mockImplementation((path) => {
    if (path.toString().endsWith("node_modules")) {
      return runtimeNodeModules;
    }

    if (previousRealpathSync) {
      return previousRealpathSync(path);
    }

    throw new Error(`ENOENT: ${path.toString()}`);
  });

  return runtimeNodeModules;
}

function resolveDefaultRuntimeNodeModules(path: unknown): string {
  if (path?.toString().endsWith("node_modules")) {
    return DEFAULT_RUNTIME_NODE_MODULES;
  }

  throw new Error(`ENOENT: ${path?.toString()}`);
}
