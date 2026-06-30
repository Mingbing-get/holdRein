import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  createServerPluginRegistry,
  loadInstalledServerPlugins,
  type RuntimePluginManifest
} from "@hold-rein/plugin-server";

export const pluginRegistry = createServerPluginRegistry();

let runtimeWebPlugins: RuntimePluginManifest[] = [];
const runtimeRequire = createRequire(import.meta.url);

export async function bootstrapServerPlugins(pluginRoot: string): Promise<void> {
  const loaded = await loadInstalledServerPlugins({
    hostNodeModules: join(process.cwd(), "node_modules"),
    pluginRoot,
    resolvePackageTarget: resolveRuntimePackageTarget
  });

  for (const plugin of loaded.plugins) {
    registerPluginIfMissing(plugin);
  }

  runtimeWebPlugins = loaded.webPlugins;
}

export function getRuntimeWebPlugins(): readonly RuntimePluginManifest[] {
  return runtimeWebPlugins;
}

function registerPluginIfMissing(
  plugin: Parameters<typeof pluginRegistry.register>[0]
): void {
  if (!pluginRegistry.has(plugin.id)) {
    pluginRegistry.register(plugin);
  }
}

function resolveRuntimePackageTarget(packageName: string): string {
  let directory = dirname(runtimeRequire.resolve(packageName));

  while (true) {
    if (hasPackageName(directory, packageName)) {
      return directory;
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
