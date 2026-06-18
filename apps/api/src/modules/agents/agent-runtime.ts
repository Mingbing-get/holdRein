import { randomUUID } from "node:crypto";

import { AgentHarness, NodeExecutionEnv, formatSkillsForSystemPrompt, loadSkills, type JsonlSessionRepoApi } from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from '@hold-rein/plugin-server'
import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus } from "./agent-event-bus";
import { toStoredAgentMessage } from "./agent-message-storage";
import { resolveAgentModel, type AgentModelLookup } from "./agent-model-resolver";
import { type AgentRunResult, type AgentSessionMetadata, type StoredAgentMessage, type RunAgentInput } from "./agent-types";
import { appendVisibleCustomMessage } from "./agent-runtime-messages";
import { runToolBeforeExecute } from "./agent-tool-approval";
import { createCallSubagentTool, extractAssistantText, formatSubagentResult, getNextCompletedSubagent, hasRunningSubagent, type SubagentRun } from "./agent-subagents";
import { createSessionRepo, getEnvApiKey, getSkillDirs, interruptHarness, toAgentSessionMetadata } from "./agent-runtime-support";
import {
  createInMemorySubagentRepository,
  type SubagentRepository
} from "./subagent-repository";
import { pluginRegistry } from '../../plugin'

const AGENT_CONTINUATION_CUSTOM_TYPE = "agent_continuation";
const AGENT_CONTINUE_PROMPT = "";
const CALL_SUBAGENT_CUSTOM_TYPE = "callsubagent";
const SUBAGENT_RESULT_CUSTOM_TYPE = "subagent_result";

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
  subagentRepository?: SubagentRepository;
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
  parentAgentId?: string;
  pluginPrompt: string;
  session?: HarnessSession;
}

type CreateHarnessOptions = StartHarnessOptions & {
  agentId: string;
  session: HarnessSession;
};

interface PendingVisibleCustomMessage {
  content: string;
  customType: string;
  details?: unknown;
}

interface StartHarnessResult {
  agentId: string;
  harnessSession: HarnessSession;
  session: AgentSessionMetadata;
}

export function createAgentRuntime(
  options: CreateAgentRuntimeOptions
): AgentRuntime {
  const runningAgents = new Map<string, RunningAgent>();
  const sessionRepo = options.sessionRepo ?? createSessionRepo();
  const subagentRepository =
    options.subagentRepository ?? createInMemorySubagentRepository();
  const subagents = new Map<string, SubagentRun<HarnessSession>>();

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
        const pendingVisibleMessages = new Map<
          string,
          PendingVisibleCustomMessage
        >();
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

        const tools = [
          ...(contribution.tools || []),
          createCallSubagentTool({
            startSubagent: async ({ agentName, prompt, toolCallId }) => {
              const agentId = `agent_${randomUUID()}`;
              const createdAt = new Date().toISOString();
              subagentRepository.create({
                agentId,
                createdAt,
                parentAgentId: harnessOptions.agentId,
                status: "running",
                taskId: input.taskId,
                updatedAt: createdAt
              });
              let started: StartHarnessResult;
              try {
                started = await startHarness(prompt, {
                  agentId,
                  agentName,
                  isContinue: false,
                  parentAgentId: harnessOptions.agentId,
                  pluginPrompt: prompt
                });
              } catch (error) {
                subagentRepository.delete(agentId);
                throw error;
              }
              const details = {
                agentId: started.agentId,
                agentName,
                parentAgentId: harnessOptions.agentId,
                session: started.session,
                taskId: input.taskId
              };
              subagents.set(started.agentId, {
                agentId: started.agentId,
                agentName,
                agentSession: started.harnessSession,
                consumed: false,
                lastAssistantText: "",
                parentAgentId: harnessOptions.agentId,
                ...(harnessOptions.agentName === undefined
                  ? {}
                  : { parentAgentName: harnessOptions.agentName }),
                parentSession: harnessOptions.session,
                session: started.session,
                status: "running"
              });
              pendingVisibleMessages.set(toolCallId, {
                content: `Subagent "${agentName}" is running.`,
                customType: CALL_SUBAGENT_CUSTOM_TYPE,
                details
              });

              return {
                content: [
                  {
                    text: `Subagent "${agentName}" is running. agentId=${started.agentId}`,
                    type: "text" as const
                  }
                ],
                details
              };
            }
          })
        ];

        const harness = new AgentHarness({
          activeToolNames: tools.map(tool => tool.name),
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
          tools
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
            const subagent = subagents.get(harnessOptions.agentId);
            if (subagent) {
              subagent.lastAssistantText = extractAssistantText(event.message);
            }
            options.eventBus.emit({
              agentId: harnessOptions.agentId,
              payload: { message },
              type: "message_end"
            });
            activeMessageId = undefined;
            if (event.message.role === "toolResult") {
              const pendingMessage = pendingVisibleMessages.get(
                event.message.toolCallId
              );
              if (pendingMessage) {
                await appendVisibleCustomMessage({
                  agentId: harnessOptions.agentId,
                  ...pendingMessage,
                  eventBus: options.eventBus,
                  session: harnessOptions.session
                });
                pendingVisibleMessages.delete(event.message.toolCallId);
              }
            }
            return;
          }
          if (event.type === "agent_end") {
            options.eventBus.emit({ agentId: harnessOptions.agentId, type: "agent_end" });
            if (harnessOptions.parentAgentId) {
              await finishSubagent(harnessOptions.agentId, contribution);
              return;
            }
            const continued = await continueOrEndTask(
              harnessOptions.agentId,
              harnessOptions.agentName,
              harnessOptions.session,
              contribution
            );
            if (!continued) {
              options.eventBus.emit({
                agentId: harnessOptions.agentId,
                type: "task_end"
              });
            }
          }
        });

        harness.on("tool_call", async (event) => {
          const tool = tools.find(tool => tool.name === event.toolName)
          if (!tool) return undefined;

          return runToolBeforeExecute({
            agentId: harnessOptions.agentId,
            approvalStore: options.approvalStore,
            event,
            eventBus: options.eventBus,
            tool,
            workspacePath: input.workspacePath
          });
        });

        return harness;
      };

      const finishSubagent = async (
        agentId: string,
        contribution: ServerPlugin.Contribution
      ) => {
        const subagent = subagents.get(agentId);
        if (!subagent) return;
        const continued = await continueOrEndTask(
          subagent.agentId,
          subagent.agentName,
          subagent.agentSession,
          contribution
        );
        if (continued) return;

        subagent.status = "completed";
        subagentRepository.updateStatus(
          subagent.agentId,
          "completed",
          new Date().toISOString()
        );
        await continueOrEndTask(
          subagent.parentAgentId,
          subagent.parentAgentName,
          subagent.parentSession,
          undefined
        );
        subagents.delete(subagent.agentId);
      };

      const continueOrEndTask = async (
        harnessAgentId: string,
        harnessAgentName: string | undefined,
        harnessSession: HarnessSession,
        contribution: ServerPlugin.Contribution | undefined
      ): Promise<boolean> => {
        const currentSubagent = subagents.get(harnessAgentId);
        const completedSubagent = getNextCompletedSubagent(
          subagents,
          harnessAgentId
        );
        if (completedSubagent) {
          completedSubagent.consumed = true;
          const prompt = formatSubagentResult(completedSubagent);
          await appendVisibleCustomMessage({
            agentId: harnessAgentId,
            content: prompt,
            customType: SUBAGENT_RESULT_CUSTOM_TYPE,
            details: {
              agentId: completedSubagent.agentId,
              agentName: completedSubagent.agentName,
              session: completedSubagent.session
            },
            eventBus: options.eventBus,
            session: harnessSession
          });
          await startHarness(AGENT_CONTINUE_PROMPT, {
            agentId: harnessAgentId,
            isContinue: true,
            pluginPrompt: prompt,
            session: harnessSession,
            ...(currentSubagent === undefined
              ? {}
              : { parentAgentId: currentSubagent.parentAgentId }),
            ...(harnessAgentName === undefined
              ? {}
              : { agentName: harnessAgentName })
          });
          return true;
        }

        if (hasRunningSubagent(subagents, harnessAgentId)) {
          return true;
        }

        const currentSessionMetadata = toAgentSessionMetadata(
          await harnessSession.getMetadata()
        );
        const context = await harnessSession.buildContext();
        const continuation = await contribution?.onAgentEnd?.({
          messages: context.messages,
          runInput: { ...input, session: currentSessionMetadata },
          session: currentSessionMetadata
        });

        if (!continuation?.prompt) {
          return false;
        }

        await appendVisibleCustomMessage({
          agentId: harnessAgentId,
          content: continuation.prompt,
          customType: AGENT_CONTINUATION_CUSTOM_TYPE,
          details: continuation.details,
          eventBus: options.eventBus,
          session: harnessSession
        });
        await startHarness(AGENT_CONTINUE_PROMPT, {
          agentId: harnessAgentId,
          isContinue: true,
          pluginPrompt: continuation.prompt,
          session: harnessSession,
          ...(currentSubagent === undefined
            ? {}
            : { parentAgentId: currentSubagent.parentAgentId }),
          ...(harnessAgentName === undefined
            ? {}
            : { agentName: harnessAgentName })
        });
        return true;
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
          harnessSession,
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
