import type {
  ApiResponse,
  InstalledPlugin,
  InstalledPluginsResponse,
  PluginInstallRequest
} from "./plugin-management-types";

export async function fetchInstalledPlugins(
  apiBaseUrl: string
): Promise<InstalledPlugin[]> {
  const response = await fetch(createPluginsUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load plugins");
  }

  const payload =
    (await response.json()) as ApiResponse<InstalledPluginsResponse>;

  return [...payload.data.plugins].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
}

export async function setPluginDisabled(
  apiBaseUrl: string,
  pluginId: string,
  disabled: boolean
): Promise<InstalledPlugin> {
  const response = await fetch(createPluginUrl(apiBaseUrl, pluginId), {
    body: JSON.stringify({ disabled }),
    headers: { "Content-Type": "application/json" },
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Failed to update plugin");
  }

  const payload = (await response.json()) as ApiResponse<InstalledPlugin>;

  return payload.data;
}

export async function installPlugin(
  apiBaseUrl: string,
  request: PluginInstallRequest
): Promise<InstalledPlugin> {
  const response = await fetch(createPluginInstallUrl(apiBaseUrl), {
    body: JSON.stringify(request),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Failed to install plugin");
  }

  const payload = (await response.json()) as ApiResponse<InstalledPlugin>;

  return payload.data;
}

export async function uninstallPlugin(
  apiBaseUrl: string,
  pluginId: string
): Promise<void> {
  const response = await fetch(createPluginUrl(apiBaseUrl, pluginId), {
    method: "DELETE"
  });

  if (!response.ok) {
    throw new Error("Failed to uninstall plugin");
  }
}

export function createPluginsUrl(apiBaseUrl: string): string {
  return `${normalizeApiBaseUrl(apiBaseUrl)}/api/v1/plugins`;
}

export function createPluginInstallUrl(apiBaseUrl: string): string {
  return `${createPluginsUrl(apiBaseUrl)}/install`;
}

export function createPluginUrl(apiBaseUrl: string, pluginId: string): string {
  return `${createPluginsUrl(apiBaseUrl)}/${encodeURIComponent(pluginId)}`;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/$/, "");
}
