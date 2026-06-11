import type {
  ApiResponse,
  WorkspaceNavigationResponse
} from "./workspace-nav-types";

export type WorkspaceNavigationFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

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

export function createWorkspaceNavigationUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/recent-tasks`;
}
