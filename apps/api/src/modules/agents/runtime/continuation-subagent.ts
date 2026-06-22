import { randomUUID } from "node:crypto";

import type { AgentEventBus } from "../event/event-bus";
import { appendVisibleCustomMessage } from "./messages";
import { toAgentSessionMetadata } from "./support";
import type {
  HarnessSession,
  StartHarnessOptions,
  StartHarnessResult
} from "./type";
import type { SubagentRun } from "../subagent";
import type { SubagentRepository } from "../subagent/repository";

const CALL_SUBAGENT_CUSTOM_TYPE = "callsubagent";
const SUBAGENT_NAME = "subagent";

type StartHarness = (
  promptText: string,
  harnessOptions: StartHarnessOptions
) => Promise<StartHarnessResult>;

interface SessionRepo {
  create: (input: { cwd: string }) => Promise<HarnessSession>;
}

export async function startContinuationSubagent(input: {
  eventBus: AgentEventBus;
  parentAgentId: string;
  parentAgentName: string | undefined;
  parentSession: HarnessSession;
  prompt: string;
  sessionRepo: SessionRepo;
  startHarness: StartHarness;
  subagentRepository: SubagentRepository;
  subagents: Map<string, SubagentRun<HarnessSession>>;
  taskId: string;
  workspacePath: string;
}): Promise<void> {
  const agentId = `agent_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const childSession = await input.sessionRepo.create({ cwd: input.workspacePath });
  const childSessionMetadata = toAgentSessionMetadata(
    await childSession.getMetadata()
  );
  input.subagentRepository.create({
    agentId,
    agentName: SUBAGENT_NAME,
    createdAt,
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
      agentName: SUBAGENT_NAME,
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
    agentName: SUBAGENT_NAME,
    agentSession: started.harnessSession,
    consumed: false,
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
    content: `Subagent "${SUBAGENT_NAME}" is running.`,
    customType: CALL_SUBAGENT_CUSTOM_TYPE,
    details: {
      agentId: started.agentId,
      agentName: SUBAGENT_NAME,
      parentAgentId: input.parentAgentId,
      session: started.session,
      taskId: input.taskId
    },
    eventBus: input.eventBus,
    session: input.parentSession
  });
}
