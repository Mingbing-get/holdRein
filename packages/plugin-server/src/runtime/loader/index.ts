import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { RuntimePluginManifest, ServerPlugin } from "../../type";
import {
  discoverServerPluginManifests,
  parseServerPluginManifest
} from "../manifest";
import { linkServerPluginSharedPackages } from "../shared/symlinks";

export interface LoadInstalledServerPluginsOptions {
  readonly hostNodeModules: string;
  readonly pluginRoot: string;
  readonly toImportUrl?: (path: string) => string;
}

export interface LoadedServerPlugins {
  readonly plugins: ServerPlugin.Plugin[];
  readonly webPlugins: RuntimePluginManifest[];
}

export async function loadInstalledServerPlugins(
  options: LoadInstalledServerPluginsOptions
): Promise<LoadedServerPlugins> {
  await linkServerPluginSharedPackages({
    hostNodeModules: options.hostNodeModules,
    pluginRoot: options.pluginRoot
  });

  const manifests = await discoverServerPluginManifests(options.pluginRoot);
  const plugins: ServerPlugin.Plugin[] = [];
  const webPlugins: RuntimePluginManifest[] = [];

  for (const manifestPath of manifests) {
    const manifest = parseServerPluginManifest(
      JSON.parse(await readFile(manifestPath, "utf8"))
    );
    const packageDir = dirname(manifestPath);
    const entryPath = resolve(packageDir, manifest.serverEntry);
    const module = await import(
      (options.toImportUrl ?? ((path) => pathToFileURL(path).href))(entryPath)
    );

    if (!module.default) {
      throw new Error(
        `Plugin "${manifest.id}" does not export a default plugin.`
      );
    }

    plugins.push(module.default as ServerPlugin.Plugin);

    if (manifest.webEntry) {
      const pluginDir = basename(packageDir);
      webPlugins.push({
        id: manifest.id,
        name: manifest.name,
        packageName: manifest.packageName,
        version: manifest.version,
        webEntry: toPluginAssetUrl(pluginDir, manifest.webEntry),
        ...(manifest.webStyle === undefined
          ? {}
          : { webStyle: toPluginAssetUrl(pluginDir, manifest.webStyle) })
      });
    }
  }

  return { plugins, webPlugins };
}

function toPluginAssetUrl(pluginDir: string, entry: string): string {
  return `/plugin-assets/${encodeURIComponent(pluginDir)}/${toPluginAssetPath(
    entry
  )}`;
}

function toPluginAssetPath(entry: string): string {
  return entry.replace(/^\.\//, "").replace(/^dist\//, "");
}
