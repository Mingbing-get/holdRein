import { randomUUID } from "node:crypto";

import type { AgentEventBus } from "../event/event-bus";
import { appendVisibleCustomMessage } from "./messages";
import { toAgentSessionMetadata } from "./support";
import type {
  ContinuationSubagentFilters,
  HarnessSession,
  StartHarnessOptions,
  StartHarnessResult
} from "./type";
import type { SubagentRun } from "../subagent";
import type { SubagentRepository } from "../subagent/repository";

const CALL_SUBAGENT_CUSTOM_TYPE = "callsubagent";
const DEFAULT_SUBAGENT_NAME = "subagent";

type StartHarness = (
  promptText: string,
  harnessOptions: StartHarnessOptions
) => Promise<StartHarnessResult>;

interface SessionRepo {
  create: (input: { cwd: string }) => Promise<HarnessSession>;
}

export async function startContinuationSubagent(input: {
  agentName?: string;
  continuationSubagentFilters?: ContinuationSubagentFilters;
  eventBus: AgentEventBus;
  parentAgentId: string;
  parentAgentName: string | undefined;
  parentDepth: number;
  parentSession: HarnessSession;
  prompt: string;
  sessionRepo: SessionRepo;
  startHarness: StartHarness;
  subagentRepository: SubagentRepository;
  subagents: Map<string, SubagentRun<HarnessSession>>;
  taskId: string;
  workspacePath: string;
}): Promise<void> {
  const depth = input.parentDepth + 1;
  const agentName = input.agentName ?? DEFAULT_SUBAGENT_NAME;
  const agentId = `agent_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const childSession = await input.sessionRepo.create({ cwd: input.workspacePath });
  const childSessionMetadata = toAgentSessionMetadata(
    await childSession.getMetadata()
  );
  input.subagentRepository.create({
    agentId,
    agentName,
    createdAt,
    depth,
    parentAgentId: input.parentAgentId,
    sessionCreatedAt: childSessionMetadata.createdAt,
    sessionId: childSessionMetadata.id,
    sessionPath: childSessionMetadata.path,
    status: "running",
    taskId: input.taskId,
    updatedAt: createdAt
  });

  let started: StartHarnessResult;
  try {
    started = await input.startHarness(input.prompt, {
      agentId,
      agentName,
      ...(input.continuationSubagentFilters === undefined
        ? {}
        : { continuationSubagentFilters: input.continuationSubagentFilters }),
      depth,
      isContinue: false,
      parentAgentId: input.parentAgentId,
      pluginPrompt: input.prompt,
      session: childSession
    });
  } catch (error) {
    input.subagentRepository.delete(agentId);
    throw error;
  }

  input.subagents.set(started.agentId, {
    agentId: started.agentId,
    agentName,
    agentSession: started.harnessSession,
    consumed: false,
    depth,
    lastAssistantText: "",
    parentAgentId: input.parentAgentId,
    ...(input.parentAgentName === undefined
      ? {}
      : { parentAgentName: input.parentAgentName }),
    parentSession: input.parentSession,
    session: started.session,
    status: "running"
  });
  await appendVisibleCustomMessage({
    agentId: input.parentAgentId,
    content: `Subagent "${agentName}" is running.`,
    customType: CALL_SUBAGENT_CUSTOM_TYPE,
    details: {
      agentId: started.agentId,
      agentName,
      parentAgentId: input.parentAgentId,
      session: started.session,
      taskId: input.taskId
    },
    eventBus: input.eventBus,
    session: input.parentSession
  });
}
