export interface ApiResponse<TData> {
  code: number;
  data: TData;
  msg: string;
}

export type PluginInstallSourceType = "github" | "local" | "npm";

export interface InstalledPlugin {
  disabled?: boolean;
  id: string;
  name: string;
  packageName: string;
  version: string;
  webEntry: string;
  webStyle?: string;
}

export interface InstalledPluginsResponse {
  plugins: InstalledPlugin[];
}

export interface PluginInstallRequest {
  source: string;
  sourceType: PluginInstallSourceType;
}
