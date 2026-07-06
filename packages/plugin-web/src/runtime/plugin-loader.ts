import type { RuntimePluginManifest, WebPlugin } from "../type";
import type { WebPluginRegistry } from "../index";
import { require } from "./require";

export interface LoadRuntimeWebPluginsOptions {
  readonly importer?: (entryUrl: string) => Promise<WebPlugin.Plugin>;
  readonly manifests: readonly RuntimePluginManifest[];
  readonly moduleImporter?: (
    entryUrl: string
  ) => Promise<{ readonly default?: WebPlugin.Plugin }>;
  readonly registry: Pick<WebPluginRegistry, "has" | "register">;
}

export async function loadRuntimeWebPlugins(
  options: LoadRuntimeWebPluginsOptions
): Promise<WebPlugin.Plugin[]> {
  const importer = options.importer ?? importRuntimePlugin;
  const moduleImporter = options.moduleImporter ?? importRuntimePluginModule;
  const loadedPlugins: WebPlugin.Plugin[] = [];

  for (const manifest of options.manifests) {
    if (manifest.disabled === true) {
      continue;
    }

    if (options.registry.has(manifest.id)) {
      continue;
    }

    loadPluginStyle(manifest);

    const module =
      manifest.webEntryType === "module"
        ? (await moduleImporter(manifest.webEntry)).default
        : await importer(manifest.webEntry);

    if (!module) {
      throw new Error(
        `Web plugin "${manifest.id}" does not export a default plugin.`
      );
    }

    if (options.registry.has(module.id)) {
      continue;
    }

    options.registry.register(module);
    loadedPlugins.push(module);
  }

  return loadedPlugins;
}

async function importRuntimePlugin(
  entryUrl: string
): Promise<WebPlugin.Plugin> {
  const [module] = await require.require([entryUrl]);

  return module as WebPlugin.Plugin;
}

async function importRuntimePluginModule(
  entryUrl: string
): Promise<{ readonly default?: WebPlugin.Plugin }> {
  const res = import(/* @vite-ignore */ entryUrl) as Promise<{
    readonly default?: WebPlugin.Plugin;
  }>;

  console.log(entryUrl, res)
  
  return res
}

function loadPluginStyle(manifest: RuntimePluginManifest): void {
  if (!manifest.webStyle || typeof document === "undefined") {
    return;
  }

  const styleUrl = new URL(manifest.webStyle, document.baseURI).href;
  const existing = Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
  ).some((link) => link.href === styleUrl);
  if (existing) {
    return;
  }

  const link = document.createElement("link");
  link.dataset.runtimePluginStyle = manifest.packageName;
  link.href = styleUrl;
  link.rel = "stylesheet";
  document.head.append(link);
}
