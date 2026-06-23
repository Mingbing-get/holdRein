import { randomUUID } from "node:crypto";

import { AgentHarness, NodeExecutionEnv, formatSkillsForSystemPrompt, loadSkills } from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from '@hold-rein/plugin-server'
import { toStoredAgentMessage } from "../message/storage";
import { resolveAgentModel } from "../model/resolver";
import { appendVisibleCustomMessage } from "./messages";
import { addPendingSubagentResult, appendSubagentResult, flushPendingSubagentResults } from "./subagent-results";
import { createRuntimeRevokeSubagentTool, createRuntimeSubagentTools } from "./subagent-tools";
import { startContinuationSubagent } from "./continuation-subagent";
import { createSessionRepo, getEnvApiKey, getSkillDirs, interruptHarness, toAgentSessionMetadata } from "./support";
import { createTokenCollection } from "./token-collection";
import { runToolBeforeExecute } from "../approval/tool-approval";
import { extractAssistantText, getNextCompletedSubagent, hasRunningSubagent, type SubagentRun } from "../subagent";
import { pluginRegistry } from '../../../plugin'
import { formatWorkspaceAgentInstructionsForSystemPrompt, readWorkspaceAgentInstructions } from "./workspace-agent-instructions";

import type { AgentRuntime, CreateAgentRuntimeOptions, RunningAgent, HarnessSession, CreateHarnessOptions, PendingVisibleCustomMessage, StartHarnessOptions, StartHarnessResult } from './type'

const AGENT_CONTINUATION_CUSTOM_TYPE = "agent_continuation";
const AGENT_CONTINUE_PROMPT = "";

export function createAgentRuntime(
  options: CreateAgentRuntimeOptions
): AgentRuntime {
  const runningAgents = new Map<string, RunningAgent>();
  const sessionRepo = options.sessionRepo ?? createSessionRepo();
  const subagentRepository = options.subagentRepository;
  const subagents = new Map<string, SubagentRun<HarnessSession>>();
  const harnessSessions = new Map<string, HarnessSession>();
  const harnessTools = new Map<string, ServerPlugin.PluginTool[]>();
  const interruptedHarnesses = new WeakSet<AgentHarness>();
  const tokenCollections = new Map<string, ReturnType<typeof createTokenCollection>>();

  return {
    getTokenUsage: (taskId) => tokenCollections.get(taskId)?.getUsage(),
    interrupt: async (agentId) => {
      const runningAgent = runningAgents.get(agentId);

      if (!runningAgent) {
        return false;
      }

      interruptedHarnesses.add(runningAgent.harness);
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

      const workspaceAgentInstructions = await readWorkspaceAgentInstructions(input.workspacePath);
      const pendingSubagentResults = new Map<string, Set<string>>();

      const createHarness = async (harnessOptions: CreateHarnessOptions) => {
        let activeMessageId: string | undefined;
        const pendingVisibleMessages = new Map<string, PendingVisibleCustomMessage[]>();
        const pluginContext: ServerPlugin.RuntimeContext = {
          agentName: harnessOptions.agentName ?? "main",
          env,
          isContinue: harnessOptions.isContinue,
          session: harnessOptions.session,
          prompt: harnessOptions.pluginPrompt,
          thinkingLevel: input.thinkingLevel,
          model
        }
        const contribution = await pluginRegistry.resolveContributions(pluginContext)
        const skillDirs = getSkillDirs(
          input.workspacePath,
          [...(options.skillDirs || []), ...(contribution.skillDirs || [])]
        );
        const { skills: loadedSkills } = await loadSkills(env, skillDirs);
        const skills = [...loadedSkills, ...(contribution.skills || [])];

        const tools = await createRuntimeSubagentTools({
          contributionTools: contribution.tools || [],
          eventBus: options.eventBus,
          parentAgentId: harnessOptions.agentId,
          ...(harnessOptions.agentName === undefined
            ? {}
            : { parentAgentName: harnessOptions.agentName }),
          parentSession: harnessOptions.session,
          pendingVisibleMessages,
          sessionRepo,
          startHarness,
          persistedSubagentRepository: subagentRepository,
          ...(options.subagentDatabase === undefined ? {} : { subagentDatabase: options.subagentDatabase }),
          subagents,
          taskId: input.taskId,
          workspacePath: input.workspacePath
        });
        harnessSessions.set(harnessOptions.agentId, harnessOptions.session);
        harnessTools.set(harnessOptions.agentId, tools);

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
              formatWorkspaceAgentInstructionsForSystemPrompt(workspaceAgentInstructions),
              `Current time: ${new Date().toISOString()}`,
              "Use shell_exec for workspace commands and skill scripts.",
              "Resolve skill-relative references from each skill file directory.",
              formatSkillsForSystemPrompt(resources.skills ?? [])
            ]
              .filter(Boolean)
              .join("\n\n"),
          thinkingLevel: input.thinkingLevel,
          tools
        });
        const tokenCollection =
          tokenCollections.get(input.taskId) ?? createTokenCollection(input.taskId);
        tokenCollections.set(input.taskId, tokenCollection);
        tokenCollection.appendHarness(harness);

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
              const pendingMessages = pendingVisibleMessages.get(
                event.message.toolCallId
              );
              if (pendingMessages) {
                for (const pendingMessage of pendingMessages) {
                  await appendVisibleCustomMessage({
                    agentId: harnessOptions.agentId,
                    ...pendingMessage,
                    eventBus: options.eventBus,
                    session: harnessOptions.session
                  });
                }
                pendingVisibleMessages.delete(event.message.toolCallId);
              }
              await flushPendingSubagentResults({
                agentId: harnessOptions.agentId,
                eventBus: options.eventBus,
                pendingSubagentResults,
                session: harnessOptions.session,
                subagents
              });
            }
            return;
          }
          if (event.type === "agent_end") {
            options.eventBus.emit({ agentId: harnessOptions.agentId, type: "agent_end" });
            if (interruptedHarnesses.has(harness)) {
              return;
            }
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
            approvalPolicy: input.approvalPolicy,
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
        subagentRepository.updateStatus(subagent.agentId, "completed", new Date().toISOString());
        await addRevokeToolToHarness(subagent.parentAgentId);
        await continueOrEndTask(
          subagent.parentAgentId,
          subagent.parentAgentName,
          subagent.parentSession,
          undefined,
          { deferIfRunning: true }
        );
      };
      const addRevokeToolToHarness = async (agentId: string) => {
        const tools = harnessTools.get(agentId);
        const parentSession = harnessSessions.get(agentId);
        if (!tools || !parentSession || tools.some((tool) => tool.name === "revoke_subagent")) {
          return;
        }
        const tool = createRuntimeRevokeSubagentTool({
          eventBus: options.eventBus,
          parentAgentId: agentId,
          parentSession,
          sessionRepo,
          startHarness,
          persistedSubagentRepository: subagentRepository,
          ...(options.subagentDatabase === undefined ? {} : { subagentDatabase: options.subagentDatabase }),
          subagents,
          taskId: input.taskId,
          workspacePath: input.workspacePath
        });
        tools.push(tool);
        await runningAgents.get(agentId)?.harness.setTools?.(tools, tools.map((item) => item.name));
      };
      const continueOrEndTask = async (
        harnessAgentId: string,
        harnessAgentName: string | undefined,
        harnessSession: HarnessSession,
        contribution: ServerPlugin.Contribution | undefined,
        continueOptions: { deferIfRunning?: boolean } = {}
      ): Promise<boolean> => {
        const currentSubagent = subagents.get(harnessAgentId);
        const completedSubagent = getNextCompletedSubagent(subagents, harnessAgentId);
        if (completedSubagent) {
          if (continueOptions.deferIfRunning && runningAgents.has(harnessAgentId)) {
            addPendingSubagentResult(pendingSubagentResults, harnessAgentId, completedSubagent.agentId);
            return true;
          }
          const prompt = await appendSubagentResult({
            agentId: harnessAgentId,
            eventBus: options.eventBus,
            pendingSubagentResults,
            session: harnessSession,
            subagent: completedSubagent
          });
          await startHarness(AGENT_CONTINUE_PROMPT, {
            agentId: harnessAgentId,
            isContinue: true,
            pluginPrompt: prompt,
            session: harnessSession,
            ...(currentSubagent === undefined ? {} : { parentAgentId: currentSubagent.parentAgentId }),
            ...(harnessAgentName === undefined ? {} : { agentName: harnessAgentName })
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

        if (continuation.useSubagent === true) {
          await startContinuationSubagent({
            ...(continuation.agentName === undefined
              ? {}
              : { agentName: continuation.agentName }),
            eventBus: options.eventBus,
            parentAgentId: harnessAgentId,
            parentAgentName: harnessAgentName,
            parentSession: harnessSession,
            prompt: continuation.prompt,
            sessionRepo,
            startHarness,
            subagentRepository,
            subagents,
            taskId: input.taskId,
            workspacePath: input.workspacePath
          });
          return true;
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
          ...(currentSubagent === undefined ? {} : { parentAgentId: currentSubagent.parentAgentId }),
          ...(harnessAgentName === undefined ? {} : { agentName: harnessAgentName })
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
