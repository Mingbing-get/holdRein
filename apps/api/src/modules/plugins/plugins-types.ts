import type { RuntimePluginManifest } from "@hold-rein/plugin-server";

export interface InstalledPlugin extends RuntimePluginManifest {
  readonly disabled: boolean;
}

export type PluginInstallSourceType = "github" | "local" | "npm";

export interface PluginInstallRequest {
  readonly source: string;
  readonly sourceType: PluginInstallSourceType;
}

export interface PluginsService {
  installPlugin: (request: PluginInstallRequest) => Promise<InstalledPlugin>;
  listDisabledPluginIds: () => Promise<string[]>;
  listPlugins: () => Promise<InstalledPlugin[]>;
  setPluginDisabled: (
    pluginId: string,
    disabled: boolean
  ) => Promise<InstalledPlugin | null>;
}
