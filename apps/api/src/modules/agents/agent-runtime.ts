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

const AGENT_CONTINUATION_CUSTOM_TYPE = "agent_continuation";
const AGENT_CONTINUE_PROMPT = "";

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

type HarnessSession = Awaited<ReturnType<JsonlSessionRepoApi["create"]>>;

interface StartHarnessOptions {
  agentId?: string;
  agentName?: string;
  isContinue: boolean;
  pluginPrompt: string;
  session?: HarnessSession;
}

type CreateHarnessOptions = StartHarnessOptions & {
  agentId: string;
  session: HarnessSession;
};

interface StartHarnessResult {
  agentId: string;
  session: AgentSessionMetadata;
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
      const env = new NodeExecutionEnv({ cwd: input.workspacePath });
      const model = await resolveAgentModel(
        input.provider,
        input.modelId,
        options.getCustomModel
      );

      if (!model) {
        throw new Error("Unknown model");
      }

      const createHarness = async (harnessOptions: CreateHarnessOptions) => {
        let activeMessageId: string | undefined;
        const pluginContext: ServerPlugin.RuntimeContext = {
          agentName: harnessOptions.agentName ?? "main",
          env,
          isContinue: harnessOptions.isContinue,
          session: harnessOptions.session,
          prompt: harnessOptions.pluginPrompt,
          thinkingLevel: 'medium',
          model
        }
        const contribution = await pluginRegistry.resolveContributions(pluginContext)
        const skillDirs = getSkillDirs(
          input.workspacePath,
          [...(options.skillDirs || []), ...(contribution.skillDirs || [])]
        );
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
          session: harnessOptions.session,
          systemPrompt: ({ resources }) =>
            [
              ...(contribution.systemPrompts || []),
              `Workspace: ${input.workspacePath}`,
              `Current time: ${new Date().toISOString()}`,
              "Use shell_exec for workspace commands and skill scripts.",
              "Resolve skill-relative references from each skill file directory.",
              formatSkillsForSystemPrompt(resources.skills ?? [])
            ]
              .filter(Boolean)
              .join("\n\n"),
          tools: contribution.tools || []
        });

        harness.subscribe(async (event) => {
          try {
            contribution.subscribe?.(event)
          } catch {
            // Keep plugin subscriber failures from breaking agent event delivery.
          }

          if (event.type === "message_start") {
            activeMessageId = `message_${randomUUID()}`;
            options.eventBus.emit({
              agentId: harnessOptions.agentId,
              payload: { message: toStoredAgentMessage(activeMessageId, event.message) },
              type: "message_start"
            });
            return;
          }
          if (event.type === "message_update" && activeMessageId) {
            options.eventBus.emit({
              agentId: harnessOptions.agentId,
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
              agentId: harnessOptions.agentId,
              payload: { message },
              type: "message_end"
            });
            activeMessageId = undefined;
            return;
          }
          if (event.type === "agent_end") {
            options.eventBus.emit({ agentId: harnessOptions.agentId, type: "agent_end" });
            await continueOrEndTask(
              harnessOptions.agentId,
              harnessOptions.agentName,
              harnessOptions.session,
              contribution
            );
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
                agentId: harnessOptions.agentId,
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
                agentId: harnessOptions.agentId,
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

        return harness;
      };

      const continueOrEndTask = async (
        harnessAgentId: string,
        harnessAgentName: string | undefined,
        harnessSession: HarnessSession,
        contribution: ServerPlugin.Contribution
      ) => {
        const currentSessionMetadata = toAgentSessionMetadata(
          await harnessSession.getMetadata()
        );
        const context = await harnessSession.buildContext();
        const continuation = await contribution.onAgentEnd?.({
          messages: context.messages,
          runInput: { ...input, session: currentSessionMetadata },
          session: currentSessionMetadata
        });

        if (!continuation?.prompt) {
          options.eventBus.emit({
            agentId: harnessAgentId,
            type: "task_end"
          });
          return;
        }

        await harnessSession.appendCustomMessageEntry(
          AGENT_CONTINUATION_CUSTOM_TYPE,
          continuation.prompt,
          true,
          continuation.details
        );
        options.eventBus.emit({
          agentId: harnessAgentId,
          payload: {
            message: {
              content: continuation.prompt,
              customType: AGENT_CONTINUATION_CUSTOM_TYPE,
              display: true,
              id: `message_${randomUUID()}`,
              role: "custom",
              timestamp: Date.now()
            } satisfies StoredAgentMessage
          },
          type: "message_start"
        });
        await startHarness(AGENT_CONTINUE_PROMPT, {
          agentId: harnessAgentId,
          isContinue: true,
          pluginPrompt: continuation.prompt,
          session: harnessSession,
          ...(harnessAgentName === undefined
            ? {}
            : { agentName: harnessAgentName })
        });
      };

      const startHarness = async (
        promptText: string,
        harnessOptions: StartHarnessOptions
      ): Promise<StartHarnessResult> => {
        const harnessAgentId = harnessOptions.agentId ?? `agent_${randomUUID()}`;
        const harnessSession =
          harnessOptions.session ?? (await sessionRepo.create({ cwd: input.workspacePath }));
        const harnessSessionMetadata = toAgentSessionMetadata(
          await harnessSession.getMetadata()
        );
        const harness = await createHarness({
          ...harnessOptions,
          agentId: harnessAgentId,
          session: harnessSession
        });
        runningAgents.set(harnessAgentId, {
          harness,
          sessionId: harnessSessionMetadata.id
        });

        void harness.prompt(promptText)
          .catch((error) => {
            options.eventBus.emit({
              agentId: harnessAgentId,
              payload: {
                message:
                  error instanceof Error ? error.message : "Agent run failed"
              },
              type: "agent_error"
            });
          })
          .finally(() => {
            if (runningAgents.get(harnessAgentId)?.harness === harness) {
              runningAgents.delete(harnessAgentId);
            }
          });

        return {
          agentId: harnessAgentId,
          session: harnessSessionMetadata
        };
      };

      const inputSession = input.session
        ? await sessionRepo.open({ ...input.session, cwd: input.workspacePath })
        : undefined;
      const startedHarness = await startHarness(input.prompt, {
        isContinue: false,
        pluginPrompt: input.prompt,
        ...(inputSession ? { session: inputSession } : {})
      });

      return {
        agentId: startedHarness.agentId,
        session: startedHarness.session,
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

function toAgentSessionMetadata(metadata: {
  createdAt: string;
  id: string;
  path: string;
}): AgentSessionMetadata {
  return {
    createdAt: metadata.createdAt,
    id: metadata.id,
    path: metadata.path
  };
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
