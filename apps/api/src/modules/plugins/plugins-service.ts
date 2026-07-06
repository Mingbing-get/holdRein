import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import {
  discoverServerPluginManifests,
  installPluginPackage as installPluginPackageDefault,
  parseServerPluginManifest,
  type InstallPluginPackageOptions,
  type RuntimePluginManifest
} from "@hold-rein/plugin-server";

import { getApiEnv } from "../../config/env";
import type {
  InstalledPlugin,
  PluginInstallRequest,
  PluginsService
} from "./plugins-types";

const CONFIG_FILE_NAME = "plugins.json";

interface PluginConfigEntry {
  readonly disabled?: boolean;
  readonly [property: string]: unknown;
}

type PluginsConfig = Record<string, PluginConfigEntry>;

export interface CreatePluginsServiceOptions {
  readonly installPluginPackage?: (
    options: InstallPluginPackageOptions
  ) => Promise<string>;
  readonly pluginRoot?: string;
  readonly runtimePluginManifests?: () => readonly RuntimePluginManifest[];
}

export function createPluginsService(
  options: CreatePluginsServiceOptions = {}
): PluginsService {
  const pluginRoot = options.pluginRoot ?? getApiEnv().pluginRoot;
  const configPath = join(pluginRoot, CONFIG_FILE_NAME);
  const installPluginPackage =
    options.installPluginPackage ?? installPluginPackageDefault;

  const readConfig = async (): Promise<PluginsConfig> => {
    try {
      return normalizeConfig(JSON.parse(await readFile(configPath, "utf8")));
    } catch {
      return {};
    }
  };

  const persistConfig = async (config: PluginsConfig): Promise<void> => {
    await mkdir(pluginRoot, { recursive: true });
    await writeFile(
      configPath,
      `${JSON.stringify(normalizeConfig(config), null, 2)}\n`,
      "utf8"
    );
  };

  const listPlugins = async (): Promise<InstalledPlugin[]> => {
    const config = await readConfig();
    const manifests = await readRuntimePluginManifests(pluginRoot);
    const pluginsById = new Map<string, InstalledPlugin>();

    for (const plugin of manifests) {
      pluginsById.set(plugin.id, {
        ...plugin,
        disabled: config[plugin.id]?.disabled === true
      });
    }

    for (const plugin of options.runtimePluginManifests?.() ?? []) {
      if (config[plugin.id]?.disabled === true) {
        continue;
      }

      pluginsById.set(plugin.id, {
        ...plugin,
        disabled: false
      });
    }

    return [...pluginsById.values()]
      .sort((left, right) => left.name.localeCompare(right.name));
  };

  return {
    installPlugin: async (request: PluginInstallRequest) => {
      const destination = await installPluginPackage({
        pluginRoot,
        source: request.source
      });
      const config = await readConfig();
      const plugin = await readRuntimePluginManifest(
        join(destination, "package.json"),
        config
      );

      if (plugin) {
        return plugin;
      }

      throw new Error("Installed plugin package does not expose a web entry");
    },
    listDisabledPluginIds: async () => {
      const config = await readConfig();

      return Object.entries(config)
        .filter(([, entry]) => entry.disabled === true)
        .map(([pluginId]) => pluginId)
        .sort();
    },
    listPlugins,
    setPluginDisabled: async (pluginId, disabled) => {
      const plugins = await listPlugins();
      const plugin = plugins.find((currentPlugin) => currentPlugin.id === pluginId);

      if (!plugin) {
        return null;
      }

      const config = await readConfig();
      await persistConfig({
        ...config,
        [pluginId]: {
          ...config[pluginId],
          disabled
        }
      });

      return { ...plugin, disabled };
    },
    uninstallPlugin: async (pluginId) => {
      const manifestPath = await findRuntimePluginManifestPath(pluginRoot, pluginId);

      if (!manifestPath) {
        return false;
      }

      await rm(dirname(manifestPath), { force: true, recursive: true });
      const config = await readConfig();
      await persistConfig(omitConfigEntry(config, pluginId));
      return true;
    }
  };
}

async function readRuntimePluginManifests(
  pluginRoot: string
): Promise<RuntimePluginManifest[]> {
  const manifestPaths = await discoverServerPluginManifests(pluginRoot);
  const plugins: InstalledPlugin[] = [];

  for (const manifestPath of manifestPaths) {
    const plugin = await readRuntimePluginManifest(manifestPath, {});

    if (plugin) {
      plugins.push(plugin);
    }
  }

  return plugins;
}

async function findRuntimePluginManifestPath(
  pluginRoot: string,
  pluginId: string
): Promise<string | null> {
  const manifestPaths = await discoverServerPluginManifests(pluginRoot);

  for (const manifestPath of manifestPaths) {
    const plugin = await readRuntimePluginManifest(manifestPath, {});

    if (plugin?.id === pluginId) {
      return manifestPath;
    }
  }

  return null;
}

async function readRuntimePluginManifest(
  manifestPath: string,
  config: PluginsConfig
): Promise<InstalledPlugin | null> {
  const packageDir = dirname(manifestPath);
  const manifest = parseServerPluginManifest(
    JSON.parse(await readFile(manifestPath, "utf8")),
    { packageDirectory: packageDir }
  );

  if (!manifest.webEntry) {
    return null;
  }

  const pluginDir = basename(packageDir);

  return {
    disabled: config[manifest.id]?.disabled === true,
    id: manifest.id,
    name: manifest.name,
    packageName: manifest.packageName,
    version: manifest.version,
    webEntry: toPluginAssetUrl(pluginDir, manifest.webEntry),
    ...(manifest.webStyle === undefined
      ? {}
      : { webStyle: toPluginAssetUrl(pluginDir, manifest.webStyle) })
  };
}

function normalizeConfig(value: unknown): PluginsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([pluginId, entry]) => pluginId && isPlainObject(entry))
      .sort(([leftPluginId], [rightPluginId]) =>
        leftPluginId.localeCompare(rightPluginId)
      )
      .map(([pluginId, entry]) => [pluginId, normalizeConfigEntry(entry)])
  );
}

function normalizeConfigEntry(entry: Record<string, unknown>): PluginConfigEntry {
  const normalizedEntry = { ...entry };

  if (typeof normalizedEntry.disabled !== "boolean") {
    delete normalizedEntry.disabled;
  }

  return normalizedEntry;
}

function omitConfigEntry(
  config: PluginsConfig,
  pluginIdToRemove: string
): PluginsConfig {
  return Object.fromEntries(
    Object.entries(config).filter(([pluginId]) => pluginId !== pluginIdToRemove)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toPluginAssetUrl(pluginDir: string, entry: string): string {
  return `/plugin-assets/${encodeURIComponent(pluginDir)}/${entry
    .replace(/^\.\//, "")
    .replace(/^dist\//, "")}`;
}
