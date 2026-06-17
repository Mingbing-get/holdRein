import type { TaskRow } from "../../db";
import type { WorkspaceRepository } from "../workspaces/workspace-repository";
import type { ActiveTaskRunRegistry } from "./active-task-run-registry";
import type { AgentEventBus } from "./agent-event-bus";
import type { AgentRuntime } from "./agent-runtime";
import type { AgentEventSubscription } from "./agent-types";

export async function startTaskRun(input: {
  activeTaskRuns?: ActiveTaskRunRegistry;
  eventBus: AgentEventBus;
  now: () => Date;
  repository: WorkspaceRepository;
  runtime: AgentRuntime;
  runtimeInput: Parameters<AgentRuntime["start"]>[0];
  taskId: string;
}) {
  input.activeTaskRuns?.markStarting(input.taskId);

  try {
    const run = await input.runtime.start(input.runtimeInput);
    input.activeTaskRuns?.register(input.taskId, run.agentId);
    monitorTaskRun({
      ...(input.activeTaskRuns
        ? { activeTaskRuns: input.activeTaskRuns }
        : {}),
      agentId: run.agentId,
      eventBus: input.eventBus,
      now: input.now,
      repository: input.repository,
      taskId: input.taskId
    });
    return run;
  } catch (error) {
    input.activeTaskRuns?.remove(input.taskId);
    input.repository.updateTaskStatus(
      input.taskId,
      "error",
      input.now().toISOString()
    );
    throw error;
  }
}

function monitorTaskRun(input: {
  activeTaskRuns?: ActiveTaskRunRegistry;
  agentId: string;
  eventBus: AgentEventBus;
  now: () => Date;
  repository: WorkspaceRepository;
  taskId: string;
}): void {
  let terminal = false;
  let subscription: AgentEventSubscription | undefined;
  subscription = input.eventBus.subscribe(
    { agentId: input.agentId },
    (event) => {
      const status: TaskRow["status"] | undefined =
        event.type === "task_end"
          ? "completed"
          : event.type === "agent_error"
            ? "error"
            : undefined;

      if (!status || terminal) return;

      terminal = true;
      input.repository.updateTaskStatus(
        input.taskId,
        status,
        input.now().toISOString()
      );
      input.activeTaskRuns?.remove(input.taskId);
      subscription?.unsubscribe();
    }
  );

  if (terminal) subscription.unsubscribe();
}
