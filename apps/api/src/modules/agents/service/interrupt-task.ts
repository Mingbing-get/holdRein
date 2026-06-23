import type { WorkspaceRepository } from "../../workspaces/workspace-repository";
import type { InterruptTaskResult } from "../agent-types";
import type { AgentRuntime } from "../runtime/type";
import { interruptRunningSubagents } from "../subagent/lifecycle";
import type { SubagentRepository } from "../subagent/repository";
import type { ActiveTaskRunRegistry } from "../task/active-run-registry";

export async function interruptTaskRun(input: {
  activeTaskRuns?: ActiveTaskRunRegistry;
  now: () => Date;
  repository: WorkspaceRepository;
  runtime: AgentRuntime;
  subagentRepository: SubagentRepository;
  taskId: string;
}): Promise<InterruptTaskResult> {
  const task = input.repository.findTaskById(input.taskId);

  if (!task) {
    return { status: "not_found", taskId: input.taskId };
  }

  const agentId = input.activeTaskRuns?.getAgentId(input.taskId);
  const interruptedAt = input.now().toISOString();
  const interruptSubagents = () =>
    interruptRunningSubagents({
      now: interruptedAt,
      runtime: input.runtime,
      subagentRepository: input.subagentRepository,
      taskId: input.taskId
    });

  if (task.status !== "running" || !agentId) {
    return toChildInterruptResult(await interruptSubagents(), input.taskId);
  }

  const interrupted = await input.runtime.interrupt(agentId);

  if (!interrupted) {
    input.activeTaskRuns?.remove(input.taskId);
    return toChildInterruptResult(await interruptSubagents(), input.taskId);
  }

  input.repository.updateTaskStatus(input.taskId, "error", interruptedAt);
  await interruptSubagents();
  input.activeTaskRuns?.remove(input.taskId);

  return { agentId, status: "interrupted", taskId: input.taskId };
}

function toChildInterruptResult(
  agentIds: string[],
  taskId: string
): InterruptTaskResult {
  const [agentId] = agentIds;

  if (!agentId) {
    return { status: "not_running", taskId };
  }

  return { agentId, status: "interrupted", taskId };
}
