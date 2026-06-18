import type { WorkspaceSummary } from "../leftSide/workspace-nav-types";

export function getActiveAgentId(
  workspaces: WorkspaceSummary[],
  taskId: string
): string | undefined {
  return workspaces
    .flatMap((workspace) => workspace.tasks)
    .find((task) => task.id === taskId)?.activeAgentId;
}
