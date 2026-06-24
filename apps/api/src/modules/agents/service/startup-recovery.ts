import type { WorkspaceRepository } from "../../workspaces/workspace-repository";
import type { SubagentRepository } from "../subagent/repository";
import type { ActiveTaskRunRegistry } from "../task/active-run-registry";

export interface StartupRecoveryResult {
  interruptedSubagentIds: string[];
  interruptedTaskIds: string[];
}

export function recoverInterruptedAgentRuns(input: {
  activeTaskRuns?: ActiveTaskRunRegistry;
  now: string;
  repository: WorkspaceRepository;
  subagentRepository: SubagentRepository;
}): StartupRecoveryResult {
  const interruptedTaskIds = input.repository
    .listWorkspaces()
    .flatMap((workspace) => input.repository.listAllTasksByWorkspaceId(workspace.id))
    .filter(
      (task) =>
        task.status === "running" &&
        input.activeTaskRuns?.getAgentId(task.id) === undefined
    )
    .map((task) => {
      input.repository.updateTaskStatus(task.id, "error", input.now);
      return task.id;
    });

  const interruptedSubagentIds = input.subagentRepository
    .interruptRunning(input.now)
    .map((subagent) => subagent.agentId);

  return { interruptedSubagentIds, interruptedTaskIds };
}
