export interface WorkspaceTaskSummary {
  id: string;
  initialUserMessage: string;
  lastContinuedAt: string;
  lastModelName: string;
  lastModelProvider: string;
  lastModelProviderSource: "built_in" | "custom";
  title: string;
}

export interface WorkspaceSummary {
  hasMore: boolean;
  id: string;
  name: string;
  path: string;
  tasks: WorkspaceTaskSummary[];
}

export interface WorkspaceNavigationResponse {
  workspaces: WorkspaceSummary[];
}

export interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}
