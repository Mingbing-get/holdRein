export type HostApiMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export type HostApiQueryValue = boolean | number | string | undefined;

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

export interface HostApiClient {
  readonly request: <TData>(
    options: HostApiRequestOptions
  ) => Promise<HostApiResult<TData>>;
}

export interface HostApiPluginIdentity {
  readonly id: string;
  readonly packageName?: string;
}

export type HostApiFactory = (plugin: HostApiPluginIdentity) => HostApiClient;

export interface CreateLoopbackHostApiClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const HOST_API_PATH_ERROR = "path must begin with /api/v1 and must not include a host.";

export function createLoopbackHostApiClient(
  options: CreateLoopbackHostApiClientOptions
): HostApiClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const requestFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async request<TData>(
      request: HostApiRequestOptions
    ): Promise<HostApiResult<TData>> {
      const path = normalizeHostApiPath(request.path);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await requestFetch(formatUrl(baseUrl, path, request.query), {
          ...(request.body === undefined
            ? {}
            : {
                body: JSON.stringify(request.body),
                headers: {
                  "Content-Type": "application/json",
                  ...(request.headers ?? {})
                }
              }),
          method: request.method ?? "GET",
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`Host API request failed with status ${response.status}.`);
        }

        return await response.json() as HostApiResult<TData>;
      } finally {
        clearTimeout(timeout);
      }
    }
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
    url.searchParams.append(key, value === undefined ? "" : String(value));
  }

  return url.href;
}
