import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createServerPluginRegistry,
  loadInstalledServerPlugins,
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
const runtimeModuleDirectory = dirname(fileURLToPath(import.meta.url));

export async function bootstrapServerPlugins(pluginRoot: string): Promise<void> {
  await reloadServerPlugins(pluginRoot);
}

export async function reloadServerPlugins(
  pluginRoot = getApiEnv().pluginRoot
): Promise<void> {
  const pluginsService = createPluginsService({ pluginRoot });
  const loaded = await loadInstalledServerPlugins({
    disabledPluginIds: await pluginsService.listDisabledPluginIds(),
    hostNodeModules: join(process.cwd(), "node_modules"),
    pluginRoot,
    resolvePackageTarget: resolveRuntimePackageTarget
  });

  pluginRegistry.replaceAll(loaded.plugins);
  runtimeWebPlugins = loaded.webPlugins;

  if (activeRouteContext) {
    await rebuildPluginRouter(activeRouteContext);
  }
}

export function getRuntimeWebPlugins(): readonly RuntimePluginManifest[] {
  return runtimeWebPlugins;
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

function resolveRuntimePackageTarget(packageName: string): string {
  let directory = runtimeModuleDirectory;

  while (true) {
    const packageDirectory = join(
      directory,
      "node_modules",
      ...packageName.split("/")
    );

    try {
      const resolvedDirectory = realpathSync(packageDirectory);

      if (hasPackageName(resolvedDirectory, packageName)) {
        return resolvedDirectory;
      }
    } catch {
      // Continue walking parent directories until the runtime package is found.
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error(`Unable to resolve package root for "${packageName}".`);
    }

    directory = parent;
  }
}

function hasPackageName(directory: string, packageName: string): boolean {
  try {
    const packageJson = JSON.parse(
      readFileSync(join(directory, "package.json"), "utf8")
    ) as { readonly name?: unknown };

    return packageJson.name === packageName;
  } catch {
    return false;
  }
}
