import type { RuntimePluginManifest, WebPlugin } from "../type";
import type { WebPluginRegistry } from "../index";

export interface LoadRuntimeWebPluginsOptions {
  readonly importer?: (entryUrl: string) => Promise<{ default?: WebPlugin.Plugin }>;
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
    if (!module.default) {
      throw new Error(
        `Web plugin "${manifest.id}" does not export a default plugin.`
      );
    }

    options.registry.register(module.default);
  }
}

async function importRuntimePlugin(
  entryUrl: string
): Promise<{ default?: WebPlugin.Plugin }> {
  return import(/* @vite-ignore */ entryUrl);
}
