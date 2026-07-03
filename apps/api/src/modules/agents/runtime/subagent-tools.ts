import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { subagents as subagentsTable, type AppDatabase, type SubagentRow } from "../../../db";
import type { AgentEventBus } from "../event/event-bus";
import { createCallSubagentTool, createRevokeSubagentTool, type SubagentRun } from "../subagent";
import type { SubagentRepository } from "../subagent/repository";
import { toAgentSessionMetadata } from "./support";
import type { HarnessSession, PendingVisibleCustomMessage, StartHarnessOptions, StartHarnessResult } from "./type";

const CALL_SUBAGENT_CUSTOM_TYPE = "callsubagent";
const MAX_MODEL_SUBAGENT_DEPTH = 3;

type StartHarness = (
  promptText: string,
  harnessOptions: StartHarnessOptions
) => Promise<StartHarnessResult>;

interface CreateRuntimeSubagentToolsInput {
  contributionTools: ServerPlugin.PluginTool[];
  depth: number;
  eventBus: AgentEventBus;
  parentAgentId: string;
  parentAgentName?: string;
  parentSession: HarnessSession;
  pendingVisibleMessages: Map<string, PendingVisibleCustomMessage[]>;
  persistedSubagentRepository: SubagentRepository;
  sessionRepo: SessionRepo;
  startHarness: StartHarness;
  subagentDatabase?: AppDatabase;
  subagents: Map<string, SubagentRun<HarnessSession>>;
  taskId: string;
  workspacePath: string;
}

interface CreateRuntimeRevokeSubagentToolInput {
  eventBus: AgentEventBus;
  parentAgentId: string;
  parentSession: HarnessSession;
  persistedSubagentRepository: SubagentRepository;
  sessionRepo: SessionRepo;
  startHarness: StartHarness;
  subagentDatabase?: AppDatabase;
  subagents: Map<string, SubagentRun<HarnessSession>>;
  taskId: string;
  workspacePath: string;
}

interface SessionRepo {
  create: (input: { cwd: string }) => Promise<HarnessSession>;
  open: (input: {
    createdAt: string;
    cwd: string;
    id: string;
    path: string;
  }) => Promise<HarnessSession>;
}

export async function createRuntimeSubagentTools(
  input: CreateRuntimeSubagentToolsInput
): Promise<ServerPlugin.PluginTool[]> {
  const hasCalledSubagent = await sessionHasCalledSubagent(input.parentSession);

  return [
    ...input.contributionTools,
    ...(input.depth < MAX_MODEL_SUBAGENT_DEPTH
      ? [createCallSubagentTool({
          startSubagent: (request) => startSubagent(input, request)
        })]
      : []),
    ...(hasCalledSubagent ? [createRuntimeRevokeSubagentTool(input)] : [])
  ];
}

export function createRuntimeRevokeSubagentTool(
  input: CreateRuntimeRevokeSubagentToolInput
): ServerPlugin.PluginTool {
  return createRevokeSubagentTool({
    continueSubagent: async ({ agentId, prompt }) => {
      const subagentRow = findSubagentRow(input.subagentDatabase, agentId);
      if (
        !subagentRow ||
        subagentRow.status !== "completed"
      ) {
        throw new Error(`Unknown completed subagent: ${agentId}`);
      }
      const session = getPersistedSubagentSession(subagentRow);
      if (!session) {
        throw new Error(`Subagent session is missing: ${agentId}`);
      }
      const existingSubagent = input.subagents.get(agentId);
      const agentName = existingSubagent?.agentName ?? subagentRow.agentName;
      const agentSession = await input.sessionRepo.open({
        ...session,
        cwd: input.workspacePath
      });
      updateSubagentStatus(input.subagentDatabase, agentId, "running");
      input.subagents.set(agentId, {
        agentId,
        agentName,
        agentSession,
        consumed: false,
        depth: subagentRow.depth,
        lastAssistantText: "",
        parentAgentId: input.parentAgentId,
        parentSession: input.parentSession,
        session,
        status: "running"
      });
      input.eventBus.emit({
        agentId: input.parentAgentId,
        payload: {
          agentId,
          agentName,
          parentAgentId: input.parentAgentId,
          session,
          taskId: input.taskId
        },
        type: "subagent_resumed"
      });
      await input.startHarness(prompt, {
        agentId,
        agentName,
        depth: subagentRow.depth,
        isContinue: true,
        parentAgentId: input.parentAgentId,
        pluginPrompt: prompt,
        session: agentSession
      });

      return {
        content: [{
          text: `Subagent "${agentName}" was revoked. agentId=${agentId}`,
          type: "text" as const
        }],
        details: {
          agentId,
          agentName,
          parentAgentId: input.parentAgentId,
          session,
          taskId: input.taskId
        }
      };
    }
  });
}

function getPersistedSubagentSession(
  subagent: SubagentRow | undefined
) {
  if (
    !subagent ||
    !subagent.sessionCreatedAt ||
    !subagent.sessionId ||
    !subagent.sessionPath
  ) {
    return undefined;
  }

  return {
    createdAt: subagent.sessionCreatedAt,
    id: subagent.sessionId,
    path: subagent.sessionPath
  };
}

function findSubagentRow(
  database: AppDatabase | undefined,
  agentId: string
): SubagentRow | undefined {
  if (!database) {
    throw new Error("Subagent database is required to revoke a subagent");
  }

  return database.db
    .select()
    .from(subagentsTable)
    .where(eq(subagentsTable.agentId, agentId))
    .get();
}

function updateSubagentStatus(
  database: AppDatabase | undefined,
  agentId: string,
  status: SubagentRow["status"]
): void {
  if (!database) {
    throw new Error("Subagent database is required to update a subagent");
  }

  database.db
    .update(subagentsTable)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(subagentsTable.agentId, agentId))
    .run();
}

async function sessionHasCalledSubagent(
  session: HarnessSession
): Promise<boolean> {
  const context = await session.buildContext();

  return context.messages.some((message) => {
    if (!message || typeof message !== "object") return false;
    const record = message as { customType?: unknown; role?: unknown };

    return record.role === "custom" && record.customType === "callsubagent";
  });
}

async function startSubagent(
  input: CreateRuntimeSubagentToolsInput,
  request: {
    agentName: string;
    prompt: string;
    toolCallId: string;
  }
) {
  const childDepth = input.depth + 1;
  const agentId = `agent_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const childSession = await input.sessionRepo.create({
    cwd: input.workspacePath
  });
  const childSessionMetadata = toAgentSessionMetadata(
    await childSession.getMetadata()
  );
  input.persistedSubagentRepository.create({
    agentId,
    agentName: request.agentName,
    createdAt,
    depth: childDepth,
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
    started = await input.startHarness(request.prompt, {
      agentId,
      agentName: request.agentName,
      depth: childDepth,
      isContinue: false,
      parentAgentId: input.parentAgentId,
      pluginPrompt: request.prompt,
      session: childSession
    });
  } catch (error) {
    input.persistedSubagentRepository.delete(agentId);
    throw error;
  }
  const details = {
    agentId: started.agentId,
    agentName: request.agentName,
    parentAgentId: input.parentAgentId,
    session: started.session,
    taskId: input.taskId
  };
  input.subagents.set(started.agentId, {
    agentId: started.agentId,
    agentName: request.agentName,
    agentSession: started.harnessSession,
    consumed: false,
    depth: childDepth,
    lastAssistantText: "",
    parentAgentId: input.parentAgentId,
    ...(input.parentAgentName === undefined
      ? {}
      : { parentAgentName: input.parentAgentName }),
    parentSession: input.parentSession,
    session: started.session,
    status: "running"
  });
  const pendingMessages = input.pendingVisibleMessages.get(request.toolCallId) ?? [];
  pendingMessages.push({
    content: `Subagent "${request.agentName}" is running.`,
    customType: CALL_SUBAGENT_CUSTOM_TYPE,
    details
  });
  input.pendingVisibleMessages.set(request.toolCallId, pendingMessages);

  return {
    content: [
      {
        text: `Subagent "${request.agentName}" is running. agentId=${started.agentId}`,
        type: "text" as const
      }
    ],
    details
  };
}
