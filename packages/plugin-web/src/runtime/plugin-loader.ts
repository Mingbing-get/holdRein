import type { RuntimePluginManifest, WebPlugin } from "../type";
import type { WebPluginRegistry } from "../index";
import { require } from "./require";

export interface LoadRuntimeWebPluginsOptions {
  readonly importer?: (entryUrl: string) => Promise<WebPlugin.Plugin>;
  readonly manifests: readonly RuntimePluginManifest[];
  readonly registry: Pick<WebPluginRegistry, "has" | "register">;
}

export async function loadRuntimeWebPlugins(
  options: LoadRuntimeWebPluginsOptions
): Promise<void> {
  const importer = options.importer ?? importRuntimePlugin;

  for (const manifest of options.manifests) {
    if (options.registry.has(manifest.id)) {
      continue;
    }

    const module = await importer(manifest.webEntry);

    if (!module) {
      throw new Error(
        `Web plugin "${manifest.id}" does not export a default plugin.`
      );
    }

    options.registry.register(module);
  }
}

async function importRuntimePlugin(
  entryUrl: string
): Promise<WebPlugin.Plugin> {
  const [module] = await require.require([entryUrl]);

  return module as WebPlugin.Plugin;
}
