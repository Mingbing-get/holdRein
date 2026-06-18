import { unlink } from "node:fs/promises";

import type { AgentRuntime } from "./agent-runtime";
import type { SubagentRepository } from "./subagent-repository";

export async function interruptRunningSubagents(input: {
  now: string;
  runtime: AgentRuntime;
  subagentRepository: SubagentRepository;
  taskId: string;
}): Promise<void> {
  const runningSubagents = input.subagentRepository
    .findByTaskId(input.taskId)
    .filter((subagent) => subagent.status === "running");

  await Promise.all(
    runningSubagents.map(async (subagent) => {
      await input.runtime.interrupt(subagent.agentId);
      input.subagentRepository.updateStatus(
        subagent.agentId,
        "interrupted",
        input.now
      );
    })
  );
}

export async function deleteSubagentsForTask(input: {
  subagentRepository: SubagentRepository;
  taskId: string;
}): Promise<void> {
  const subagents = input.subagentRepository.findByTaskId(input.taskId);

  for (const subagent of subagents) {
    if (subagent.sessionPath) {
      await deleteSessionFile(subagent.sessionPath);
    }
  }

  for (const subagent of subagents) {
    input.subagentRepository.delete(subagent.agentId);
  }
}

async function deleteSessionFile(sessionPath: string): Promise<void> {
  try {
    await unlink(sessionPath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
