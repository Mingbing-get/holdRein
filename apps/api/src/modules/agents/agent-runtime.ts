import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  AgentHarness,
  JsonlSessionRepo,
  NodeExecutionEnv,
  formatSkillsForSystemPrompt,
  loadSkills,
  type JsonlSessionRepoApi
} from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from '@hold-rein/plugin-server'
import { SESSIONS_DIR } from "../../config/const";
import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus } from "./agent-event-bus";
import { toStoredAgentMessage } from "./agent-message-storage";
import {
  resolveAgentModel,
  type AgentModelLookup
} from "./agent-model-resolver";
import {
  type AgentRunResult,
  type AgentSessionMetadata,
  type StoredAgentMessage,
  type ToolApprovalRequest,
  type RunAgentInput
} from "./agent-types";
import { pluginRegistry } from '../../plugin'

export interface AgentRuntime {
  interrupt: (agentId: string) => Promise<boolean>;
  listMessages: (input: {
    session: AgentSessionMetadata;
    workspacePath: string;
  }) => Promise<StoredAgentMessage[]>;
  start: (input: RunAgentInput) => Promise<AgentRunResult>;
}

export interface CreateAgentRuntimeOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  getApiKey?: (provider: string, modelId: string) => Promise<string | undefined>;
  getCustomModel?: AgentModelLookup;
  sessionRepo?: JsonlSessionRepoApi;
  skillDirs?: string[];
}

interface RunningAgent {
  harness: AgentHarness;
  sessionId: string;
}

interface InterruptibleHarness {
  abort?: () => Promise<unknown> | unknown;
  interrupt?: () => Promise<unknown> | unknown;
}

export function createAgentRuntime(
  options: CreateAgentRuntimeOptions
): AgentRuntime {
  const runningAgents = new Map<string, RunningAgent>();
  const sessionRepo = options.sessionRepo ?? createSessionRepo();

  return {
    interrupt: async (agentId) => {
      const runningAgent = runningAgents.get(agentId);

      if (!runningAgent) {
        return false;
      }

      runningAgents.delete(agentId);
      await interruptHarness(runningAgent.harness);
      return true;
    },
    listMessages: async ({ session: metadata, workspacePath }) => {
      const session = await sessionRepo.open({ ...metadata, cwd: workspacePath });
      const context = await session.buildContext();

      return context.messages.map((message) =>
        toStoredAgentMessage(`message_${randomUUID()}`, message)
      );
    },
    start: async (input) => {
      const agentId = `agent_${randomUUID()}`;
      const env = new NodeExecutionEnv({ cwd: input.workspacePath });
      const session = input.session
        ? await sessionRepo.open({ ...input.session, cwd: input.workspacePath })
        : await sessionRepo.create({ cwd: input.workspacePath });
      const sessionMetadata = await session.getMetadata();
      const model = await resolveAgentModel(
        input.provider,
        input.modelId,
        options.getCustomModel
      );

      if (!model) {
        throw new Error("Unknown model");
      }

      const pluginContext: ServerPlugin.RuntimeContext = {
        env,
        session,
        prompt: input.prompt,
        thinkingLevel: 'medium',
        model
      }
      const contribution = await pluginRegistry.resolveContributions(pluginContext)

      const skillDirs = getSkillDirs(input.workspacePath, [...(options.skillDirs || []), ...(contribution.skillDirs || [])]);
      const { skills: loadedSkills } = await loadSkills(env, skillDirs);
      const skills = [...loadedSkills, ...(contribution.skills || [])];

      const harness = new AgentHarness({
        activeToolNames: contribution.tools?.map(tool => tool.name) || [],
        env,
        getApiKeyAndHeaders: async () => {
          const apiKey =
            (await options.getApiKey?.(input.provider, input.modelId)) ??
            getEnvApiKey(input.provider);

          return apiKey ? { apiKey } : undefined;
        },
        model: contribution.model || model,
        resources: { skills },
        session,
        systemPrompt: ({ resources }) =>
          [
            ...(contribution.systemPrompts || []),
            "Use shell_exec for workspace commands and skill scripts.",
            "Resolve skill-relative references from each skill file directory.",
            formatSkillsForSystemPrompt(resources.skills ?? [])
          ]
            .filter(Boolean)
            .join("\n\n"),
        tools: contribution.tools || []
      });

      let activeMessageId: string | undefined;
      harness.subscribe((event) => {
        try {
          contribution.subscribe?.(event)
        } catch {
          // Keep plugin subscriber failures from breaking agent event delivery.
        }

        if (event.type === "message_start") {
          activeMessageId = `message_${randomUUID()}`;
          options.eventBus.emit({
            agentId,
            payload: { message: toStoredAgentMessage(activeMessageId, event.message) },
            type: "message_start"
          });
          return;
        }
        if (event.type === "message_update" && activeMessageId) {
          options.eventBus.emit({
            agentId,
            payload: {
              delta: event.assistantMessageEvent,
              messageId: activeMessageId
            },
            type: "message_delta"
          });
          return;
        }
        if (event.type === "message_end") {
          const messageId = activeMessageId ?? `message_${randomUUID()}`;
          const message = toStoredAgentMessage(messageId, event.message);
          options.eventBus.emit({
            agentId,
            payload: { message },
            type: "message_end"
          });
          activeMessageId = undefined;
          return;
        }
        if (event.type === "agent_end") {
          options.eventBus.emit({ agentId, type: "agent_end" });
        }
      });

      harness.on("tool_call", async (event) => {
        const tool = contribution.tools?.find(tool => tool.name === event.toolName)
        if (!tool?.beforeExecute) return

        const beforeExecuteoptions: ServerPlugin.ToolBeforeExecuteOptions = {
          workspacePath: input.workspacePath,
          event,
          requestApproval: async (title) => {
            const approvalId = `approval_${randomUUID()}`;
            const approvalRequest: ToolApprovalRequest = {
              agentId,
              approvalId,
              ...(title === undefined ? {} : { title }),
              tool: {
                name: tool.name,
                input: event.input,
                ...(tool.description === undefined ? {} : { description: tool.description }),
                ...(tool.label === undefined ? {} : { label: tool.label }),
                toolCallId: event.toolCallId
              }
            };
            const approval = options.approvalStore.request(approvalRequest);
            options.eventBus.emit({
              agentId,
              payload: approvalRequest,
              type: "approval_requested"
            });

            const decision = await approval;

            return decision.approved
              ? undefined
              : {
                  block: true,
                  reason:
                    decision.reason?.trim() ||
                    `User denied execute tool: ${tool.name}`
                };
          }
        }

        return await tool.beforeExecute(beforeExecuteoptions)
      });

      runningAgents.set(agentId, { harness, sessionId: sessionMetadata.id });

      void harness.prompt(input.prompt)
        .catch((error) => {
          options.eventBus.emit({
            agentId,
            payload: {
              message:
                error instanceof Error ? error.message : "Agent run failed"
            },
            type: "agent_error"
          });
        })
        .finally(() => {
          runningAgents.delete(agentId);
        });

      return {
        agentId,
        session: {
          createdAt: sessionMetadata.createdAt,
          id: sessionMetadata.id,
          path: sessionMetadata.path
        },
        status: "running"
      };
    }
  };
}

async function interruptHarness(harness: AgentHarness): Promise<void> {
  const interruptibleHarness = harness as unknown as InterruptibleHarness;

  if (interruptibleHarness.interrupt) {
    await interruptibleHarness.interrupt();
    return;
  }

  if (interruptibleHarness.abort) {
    await interruptibleHarness.abort();
    return;
  }

  throw new Error("Agent runtime does not support interruption");
}

function createSessionRepo(): JsonlSessionRepoApi {
  return new JsonlSessionRepo({
    fs: new NodeExecutionEnv({ cwd: SESSIONS_DIR }),
    sessionsRoot: SESSIONS_DIR
  });
}

function getSkillDirs(workspacePath: string, configuredSkillDirs?: string[]): string[] {
  return configuredSkillDirs ?? [
    join(workspacePath, ".hold-rein", "skills"),
    join(homedir(), ".hold-rein", "skills")
  ];
}

function getEnvApiKey(provider: string): string | undefined {
  return process.env[`${provider.toUpperCase()}_API_KEY`];
}
