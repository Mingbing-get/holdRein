import { createAgentApi, type HostApiAgentClient } from "./agent";
import {
  createModelProvidersApi,
  type HostApiModelProvidersClient
} from "./model-providers";
import {
  createModelProxiesApi,
  type HostApiModelProxiesClient
} from "./model-proxies";
import { createPluginsApi, type HostApiPluginsClient } from "./plugins";
import {
  createScheduledTasksApi,
  type HostApiScheduledTasksClient
} from "./scheduled-tasks";
import { createSkillsApi, type HostApiSkillsClient } from "./skills";
import { createUsageStatsApi, type HostApiUsageStatsClient } from "./usage-stats";
import { createWorkspacesApi, type HostApiWorkspacesClient } from "./workspaces";

export type * from "./agent";
export type * from "./model-providers";
export type * from "./model-proxies";
export type * from "./plugins";
export type * from "./scheduled-tasks";
export type * from "./skills";
export type * from "./usage-stats";
export type * from "./workspaces";

type HostApiMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

type HostApiQueryValue = boolean | number | string | undefined;

export interface HostApiRequestOptions {
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly method?: HostApiMethod;
  readonly path: string;
  readonly query?: Readonly<Record<string, HostApiQueryValue>>;
}

export interface HostApiResult<TData> {
  readonly code: number;
  readonly data: TData;
  readonly msg: string;
}

export type HostApiRequest = <TData>(
  options: HostApiRequestOptions
) => Promise<HostApiResult<TData>>;

export interface HostApiClient {
  readonly agent: HostApiAgentClient;
  readonly modelProviders: HostApiModelProvidersClient;
  readonly modelProxies: HostApiModelProxiesClient;
  readonly plugins: HostApiPluginsClient;
  readonly scheduledTasks: HostApiScheduledTasksClient;
  readonly skills: HostApiSkillsClient;
  readonly usageStats: HostApiUsageStatsClient;
  readonly workspaces: HostApiWorkspacesClient;
}

export interface HostApiPluginIdentity {
  readonly id: string;
  readonly packageName?: string;
}

export type HostApiFactory = (plugin: HostApiPluginIdentity) => HostApiClient;

export interface CreateLoopbackHostApiClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
}

const HOST_API_PATH_ERROR = "path must begin with /api/v1 and must not include a host.";

export function createLoopbackHostApiClient(
  options: CreateLoopbackHostApiClientOptions
): HostApiClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const requestFetch = options.fetch ?? fetch;

  const request: HostApiRequest = async <TData>(
    requestOptions: HostApiRequestOptions
  ): Promise<HostApiResult<TData>> => {
    const path = normalizeHostApiPath(requestOptions.path);

    const response = await requestFetch(
      formatUrl(baseUrl, path, requestOptions.query),
      {
        ...(requestOptions.body === undefined
          ? {}
          : {
              body: JSON.stringify(requestOptions.body),
              headers: {
                "Content-Type": "application/json",
                ...(requestOptions.headers ?? {})
              }
            }),
        method: requestOptions.method ?? "GET"
      }
    );

    if (!response.ok) {
      throw new Error(`Host API request failed with status ${response.status}.`);
    }

    return await response.json() as HostApiResult<TData>;
  };

  return {
    agent: createAgentApi(request),
    modelProviders: createModelProvidersApi(request),
    modelProxies: createModelProxiesApi(request),
    plugins: createPluginsApi(request),
    scheduledTasks: createScheduledTasksApi(request),
    skills: createSkillsApi(request),
    usageStats: createUsageStatsApi(request),
    workspaces: createWorkspacesApi(request)
  };
}

export function createLoopbackHostApiFactory(
  options: CreateLoopbackHostApiClientOptions
): HostApiFactory {
  return () => createLoopbackHostApiClient(options);
}

function normalizeHostApiPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    throw new Error(HOST_API_PATH_ERROR);
  }

  const [pathname] = path.split("?");
  if (!pathname || pathname.includes("..")) {
    throw new Error(HOST_API_PATH_ERROR);
  }

  if (pathname !== "/api/v1" && !pathname.startsWith("/api/v1/")) {
    throw new Error(HOST_API_PATH_ERROR);
  }

  return pathname;
}

function formatUrl(
  baseUrl: string,
  path: string,
  query: Readonly<Record<string, HostApiQueryValue>> | undefined
): string {
  const url = new URL(`${baseUrl}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) {
      continue;
    }

    url.searchParams.append(key, String(value));
  }

  return url.href;
}
