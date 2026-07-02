import type {
  ApiResponse,
  UpdateWorkspaceSettingRequest,
  UpdateWorkspaceSettingResponse,
  WorkspaceNavigationResponse,
  WorkspaceSettingResponse,
  WorkspaceTaskPageResponse
} from "./workspace-nav-types";

export type WorkspaceNavigationFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function deleteTask(
  apiBaseUrl: string,
  taskId: string,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<{ taskId: string }> {
  return requestTaskMutation<{ taskId: string }>(
    apiBaseUrl,
    taskId,
    { method: "DELETE" },
    "Failed to delete task",
    fetcher
  );
}

export async function deleteWorkspace(
  apiBaseUrl: string,
  workspaceId: string,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<{ workspaceId: string }> {
  const response = await fetcher(
    `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
    { method: "DELETE" }
  );
  const payload = (await response.json()) as ApiResponse<{
    workspaceId: string;
  } | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || "Failed to delete workspace");
  }

  return payload.data;
}

export async function fetchWorkspaceNavigation(
  apiBaseUrl: string
): Promise<WorkspaceNavigationResponse> {
  const response = await fetch(createWorkspaceNavigationUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load workspace navigation");
  }

  const payload =
    (await response.json()) as ApiResponse<WorkspaceNavigationResponse>;

  return payload.data;
}

export async function fetchWorkspaceSetting(
  apiBaseUrl: string,
  workspaceId: string,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<WorkspaceSettingResponse> {
  const response = await fetcher(
    createWorkspaceSettingUrl(apiBaseUrl, workspaceId)
  );
  const payload =
    (await response.json()) as ApiResponse<WorkspaceSettingResponse | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || "Failed to load workspace setting");
  }

  return payload.data;
}

export async function fetchWorkspaceTaskPage(
  apiBaseUrl: string,
  workspaceId: string,
  afterLastContinuedAt: string,
  limit: number,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<WorkspaceTaskPageResponse> {
  const response = await fetcher(
    createWorkspaceTaskPageUrl(
      apiBaseUrl,
      workspaceId,
      afterLastContinuedAt,
      limit
    )
  );
  const payload =
    (await response.json()) as ApiResponse<WorkspaceTaskPageResponse | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || "Failed to load workspace tasks");
  }

  return payload.data;
}

export async function renameTask(
  apiBaseUrl: string,
  taskId: string,
  title: string,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<{ id: string; title: string }> {
  return requestTaskMutation<{ id: string; title: string }>(
    apiBaseUrl,
    taskId,
    {
      body: JSON.stringify({ title }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    },
    "Failed to rename task",
    fetcher
  );
}

export async function updateWorkspaceSetting(
  apiBaseUrl: string,
  workspaceId: string,
  request: UpdateWorkspaceSettingRequest,
  fetcher: WorkspaceNavigationFetcher = fetch
): Promise<UpdateWorkspaceSettingResponse> {
  const response = await fetcher(
    createWorkspaceSettingUrl(apiBaseUrl, workspaceId),
    {
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    }
  );
  const payload =
    (await response.json()) as ApiResponse<UpdateWorkspaceSettingResponse | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || "Failed to update workspace setting");
  }

  return payload.data;
}

export function createWorkspaceNavigationUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/recent-tasks`;
}

function createWorkspaceTaskPageUrl(
  apiBaseUrl: string,
  workspaceId: string,
  afterLastContinuedAt: string,
  limit: number
): string {
  const params = new URLSearchParams({
    afterLastContinuedAt,
    limit: String(limit)
  });

  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks?${params.toString()}`;
}

function createWorkspaceSettingUrl(
  apiBaseUrl: string,
  workspaceId: string
): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/setting`;
}

async function requestTaskMutation<T>(
  apiBaseUrl: string,
  taskId: string,
  init: RequestInit,
  fallbackMessage: string,
  fetcher: WorkspaceNavigationFetcher
): Promise<T> {
  const response = await fetcher(
    `${apiBaseUrl.replace(/\/$/, "")}/api/v1/agents/tasks/${encodeURIComponent(taskId)}`,
    init
  );
  const payload = (await response.json()) as ApiResponse<T | null>;

  if (!response.ok || !payload.data) {
    throw new Error(payload.msg || fallbackMessage);
  }

  return payload.data;
}
