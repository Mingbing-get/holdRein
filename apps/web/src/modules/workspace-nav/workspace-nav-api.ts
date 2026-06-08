import type {
  ApiResponse,
  WorkspaceNavigationResponse
} from "./workspace-nav-types";

export async function fetchWorkspaceNavigation(
  apiBaseUrl: string
): Promise<WorkspaceNavigationResponse> {
  const response = await fetch(createWorkspaceNavigationUrl(apiBaseUrl));

  if (!response.ok) {
    throw new Error("Failed to load workspace navigation");
  }

  const payload = (await response.json()) as ApiResponse<WorkspaceNavigationResponse>;

  return payload.data;
}

export function createWorkspaceNavigationUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}/api/v1/workspaces/recent-tasks`;
}
