import type { HostApiRequest, HostApiResult } from "..";

export type HostApiRuntimeWebEntryType = "module" | "umd";

export interface HostApiInstalledPlugin {
  readonly disabled: boolean;
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly webEntry: string;
  readonly webEntryType?: HostApiRuntimeWebEntryType;
  readonly webStyle?: string;
}

export interface HostApiInstalledPluginsResult {
  readonly plugins: readonly HostApiInstalledPlugin[];
}

export interface HostApiPluginsClient {
  readonly list: () => Promise<HostApiResult<HostApiInstalledPluginsResult>>;
}

export function createPluginsApi(request: HostApiRequest): HostApiPluginsClient {
  return {
    list() {
      return request<HostApiInstalledPluginsResult>({
        path: "/api/v1/plugins"
      });
    }
  };
}
