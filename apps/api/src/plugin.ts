import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createServerPluginRegistry,
  createLoopbackHostApiFactory,
  loadInstalledServerPlugins,
  type DevPluginManager,
  type DevServerPluginEntry,
  type ServerPlugin,
  type RuntimePluginManifest
} from "@hold-rein/plugin-server";
import { Router, type RequestHandler } from "express";
import { getApiEnv } from "./config/env";
import { createPluginsService } from "./modules/plugins/plugins-service";

export const pluginRegistry = createServerPluginRegistry();

let runtimeWebPlugins: RuntimePluginManifest[] = [];
let activePluginRouter: Router = Router();
let activeRouteContext: ServerPlugin.RouteContext | null = null;
let activeHostApiFactory:
  | ReturnType<typeof createLoopbackHostApiFactory>
  | undefined;
let activeDevPluginManager: DevPluginManager | undefined;
let devImportVersion = 0;
let activeDevPlugins: ServerPlugin.Plugin[] = [];
const runtimeModuleDirectory = dirname(fileURLToPath(import.meta.url));

export interface ReloadServerPluginsOptions {
  readonly devPluginManager?: DevPluginManager;
  readonly hostApiBaseUrl?: string;
  readonly importDevModule?: (
    importUrl: string
  ) => Promise<{ readonly default?: ServerPlugin.Plugin }>;
}

export async function bootstrapServerPlugins(
  pluginRoot: string,
  options: ReloadServerPluginsOptions = {}
): Promise<void> {
  await reloadServerPlugins(pluginRoot, options);
}

export async function reloadServerPlugins(
  pluginRoot = getApiEnv().pluginRoot,
  options: ReloadServerPluginsOptions = {}
): Promise<void> {
  activeDevPluginManager = options.devPluginManager ?? activeDevPluginManager;
  activeHostApiFactory = options.hostApiBaseUrl === undefined
    ? activeHostApiFactory
    : createLoopbackHostApiFactory({ baseUrl: options.hostApiBaseUrl });
  const pluginsService = createPluginsService({ pluginRoot });
  const loaded = await loadInstalledServerPlugins({
    disabledPluginIds: await pluginsService.listDisabledPluginIds(),
    hostNodeModules: resolveRuntimeNodeModules(),
    pluginRoot
  });
  const devLoaded = await loadDevServerPlugins({
    entries: activeDevPluginManager?.getServerPluginEntries() ?? [],
    ...(options.importDevModule === undefined
      ? {}
      : { importDevModule: options.importDevModule })
  });

  await disposeDevPlugins(activeDevPlugins);
  activeDevPlugins = [...devLoaded.plugins];

  const activePlugins = [...loaded.plugins, ...devLoaded.plugins];

  await notifyPluginsLoaded(activePlugins);

  pluginRegistry.replaceAll(activePlugins);
  runtimeWebPlugins = [
    ...loaded.webPlugins,
    ...(activeDevPluginManager?.getWebPluginManifests() ?? [])
  ];

  if (activeRouteContext) {
    await rebuildPluginRouter(activeRouteContext);
  }
}

export function getRuntimeWebPlugins(): readonly RuntimePluginManifest[] {
  return runtimeWebPlugins;
}

export function clearRuntimePluginsForTests(): void {
  runtimeWebPlugins = [];
  activePluginRouter = Router();
  activeRouteContext = null;
  activeHostApiFactory = undefined;
  activeDevPluginManager = undefined;
  devImportVersion = 0;
  activeDevPlugins = [];
}

export async function createRuntimePluginRequestHandler(
  context: ServerPlugin.RouteContext
): Promise<RequestHandler> {
  activeRouteContext = context;
  await rebuildPluginRouter(context);

  return (request, response, next) => {
    activePluginRouter(request, response, next);
  };
}

async function rebuildPluginRouter(
  context: ServerPlugin.RouteContext
): Promise<void> {
  const nextPluginRouter = Router();

  await pluginRegistry.registerRoutes(nextPluginRouter, context);
  activePluginRouter = nextPluginRouter;
}

async function notifyPluginsLoaded(
  plugins: readonly ServerPlugin.Plugin[]
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.onLoaded) {
      continue;
    }

    await plugin.onLoaded({
      ...(activeHostApiFactory === undefined
        ? {}
        : {
            hostApi: activeHostApiFactory({
              id: plugin.id,
              ...(plugin.packageName === undefined
                ? {}
                : { packageName: plugin.packageName })
            })
          })
    });
  }
}

async function loadDevServerPlugins(options: {
  readonly entries: readonly DevServerPluginEntry[];
  readonly importDevModule?: (
    importUrl: string
  ) => Promise<{ readonly default?: ServerPlugin.Plugin }>;
}): Promise<{ readonly plugins: readonly ServerPlugin.Plugin[] }> {
  if (options.entries.length === 0) {
    return { plugins: [] };
  }

  devImportVersion += 1;
  const importDevModule = options.importDevModule ?? ((url) => import(url));
  const plugins: ServerPlugin.Plugin[] = [];

  for (const entry of options.entries) {
    const importUrl = toDevImportUrl(entry.entryPath, devImportVersion);
    const module = await importDevModule(importUrl);

    if (!module.default) {
      throw new Error(
        `Plugin "${entry.manifest.id}" does not export a default plugin.`
      );
    }

    plugins.push({
      ...module.default,
      packageName: entry.manifest.packageName
    });
  }

  return { plugins };
}

async function disposeDevPlugins(
  plugins: readonly ServerPlugin.Plugin[]
): Promise<void> {
  for (const plugin of plugins) {
    await plugin.dispose?.();
  }
}

function toDevImportUrl(entryPath: string, importVersion: number): string {
  const url = pathToFileURL(entryPath);
  url.searchParams.set("holdReinReload", String(importVersion));
  return url.href;
}

function resolveRuntimeNodeModules(): string {
  let directory = runtimeModuleDirectory;

  while (true) {
    const nodeModulesDirectory = join(directory, "node_modules");

    try {
      return realpathSync(nodeModulesDirectory);
    } catch {
      // Continue walking parent directories until runtime dependencies are found.
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error("Unable to resolve runtime node_modules directory.");
    }

    directory = parent;
  }
}
