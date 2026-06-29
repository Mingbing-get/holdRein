import { join } from "node:path";

import {
  createServerPluginRegistry,
  loadInstalledServerPlugins,
  type RuntimePluginManifest
} from "@hold-rein/plugin-server";

export const pluginRegistry = createServerPluginRegistry();

let runtimeWebPlugins: RuntimePluginManifest[] = [];

export async function bootstrapServerPlugins(pluginRoot: string): Promise<void> {
  const loaded = await loadInstalledServerPlugins({
    hostNodeModules: join(process.cwd(), "node_modules"),
    pluginRoot
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
