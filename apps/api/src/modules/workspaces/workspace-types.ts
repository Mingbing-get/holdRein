import type { TaskRow, WorkspaceRow } from "../../db";

export interface WorkspaceTaskSummary {
  activeAgentId?: string;
  approvalPolicy: TaskRow["approvalPolicy"];
  id: string;
  initialUserMessage: string;
  lastContinuedAt: string;
  lastModelName: string;
  lastModelProvider: string;
  lastModelProviderSource: TaskRow["lastModelProviderSource"];
  status: TaskRow["status"];
  thinkingLevel: TaskRow["thinkingLevel"];
  title: string;
}

export interface WorkspaceWithTasksSummary {
  hasMore: boolean;
  id: string;
  name: string;
  path: string;
  tasks: WorkspaceTaskSummary[];
}

export interface RecentWorkspaceTasksResult {
  workspaces: WorkspaceWithTasksSummary[];
}

export interface WorkspaceTaskPageResult {
  hasMore: boolean;
  tasks: WorkspaceTaskSummary[];
  workspaceId: string;
}

export type WorkspaceNavigationRow = WorkspaceRow;
export type WorkspaceNavigationTaskRow = TaskRow;
