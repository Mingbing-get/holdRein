import { randomUUID } from "node:crypto";
import { AgentHarness, NodeExecutionEnv, formatSkillsForSystemPrompt } from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from '@hold-rein/plugin-server'
import { toStoredAgentMessage } from "../message/storage";
import { resolveAgentModel } from "../model/resolver";
import { appendVisibleCustomMessage } from "./messages";
import { addPendingSubagentResult, appendSubagentResult } from "./subagent-results";
import { createRuntimeRevokeSubagentTool, createRuntimeSubagentTools } from "./subagent-tools";
import { startContinuationSubagent } from "./continuation-subagent";
import { createSessionRepo, getEnvApiKey, interruptHarness, toAgentSessionMetadata } from "./support";
import { createRuntimeTokenCollectionOptions, createTokenCollection } from "./token-collection";
import { runToolBeforeExecute } from "../approval/tool-approval";
import { getNextCompletedSubagent, hasRunningSubagent, type SubagentRun } from "../subagent";
import { pluginRegistry } from '../../../plugin'
import { formatWorkspaceAgentInstructionsForSystemPrompt, readWorkspaceAgentInstructions } from "./workspace-agent-instructions";
import { createModelProxyRuntimeController, type ModelProxyRuntimeController } from "../../model-proxies/model-proxy-runtime";
import { createBrowserToolCallStore } from "./browser-tool-call-store";
import { createBrowserRuntimeTools } from "./browser-runtime-tools";
import { loadRuntimeSkills } from "./skills";
import { createWithMaterializedSkills } from "./materialized-skills";
import { subscribeHarnessEvents } from "./harness-events";
import type { AgentRuntime, CreateAgentRuntimeOptions, RunningAgent, HarnessSession, CreateHarnessOptions, PendingVisibleCustomMessage, StartHarnessOptions, StartHarnessResult } from './type'
import type { Api, Model } from "@earendil-works/pi-ai";
const AGENT_CONTINUATION_CUSTOM_TYPE = "agent_continuation";
export function createAgentRuntime(
  options: CreateAgentRuntimeOptions
): AgentRuntime {
  const runningAgents = new Map<string, RunningAgent>();
  const sessionRepo = options.sessionRepo ?? createSessionRepo();
  const subagentRepository = options.subagentRepository;
  const subagents = new Map<string, SubagentRun<HarnessSession>>();
  const harnessSessions = new Map<string, HarnessSession>();
  const harnessTools = new Map<string, ServerPlugin.PluginTool[]>();
  const harnessSkillCleanups = new WeakMap<AgentHarness, () => Promise<void>>();
  const interruptedHarnesses = new WeakSet<AgentHarness>();
  const tokenCollections = new Map<string, ReturnType<typeof createTokenCollection>>();
  const browserToolCalls = createBrowserToolCallStore();
  return {
    interrupt: async (agentId) => {
      const runningAgent = runningAgents.get(agentId);
      if (!runningAgent) {
        return false;
      }
      interruptedHarnesses.add(runningAgent.harness);
      browserToolCalls.clearAgent(agentId);
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
    submitBrowserToolResult: async (input) =>
      browserToolCalls.submitResult(input),
    start: async (input) => {
      const env = new NodeExecutionEnv({ cwd: input.workspacePath });
      const proxyCandidate = input.provider === "local"
        ? options.modelProxiesService?.selectCandidate(input.modelId)
        : undefined;
      if (input.provider === "local" && !proxyCandidate) {
        throw new Error(
          options.modelProxiesService ? "No available model for proxy" : "Unknown proxy model"
        );
      }
      const initialProvider = proxyCandidate?.provider ?? input.provider;
      const initialModelId = proxyCandidate?.modelId ?? input.modelId;
      const resolvedModel = await resolveAgentModel(initialProvider, initialModelId, options.getCustomModel);
      if (!resolvedModel) {
        throw new Error("Unknown model");
      }
      let model: Model<Api> = resolvedModel;
      const workspaceAgentInstructions = await readWorkspaceAgentInstructions(input.workspacePath);
      const pendingSubagentResults = new Map<string, Set<string>>();
      const createHarness = async (harnessOptions: CreateHarnessOptions) => {
        let activeModel: Model<Api> = model;
        let proxyController: ModelProxyRuntimeController | undefined;
        const pendingVisibleMessages = new Map<string, PendingVisibleCustomMessage[]>();
        const pluginContext: ServerPlugin.RuntimeContext = {
          agentName: harnessOptions.agentName ?? "main",
          env,
          isContinue: harnessOptions.isContinue,
          session: harnessOptions.session,
          prompt: harnessOptions.pluginPrompt,
          taskId: input.taskId,
          thinkingLevel: input.thinkingLevel,
          model: activeModel
        }
        const continuationSubagentFilters = harnessOptions.continuationSubagentFilters;
        const contribution = await pluginRegistry.resolveContributions(pluginContext, {
          ...(input.activePlugins === undefined
            ? {}
            : { activePluginPackageNames: input.activePlugins }),
          ...(continuationSubagentFilters?.pluginFilter === undefined
            ? {}
            : { pluginFilter: continuationSubagentFilters.pluginFilter })
        });
        const browserTools = createBrowserRuntimeTools({
          agentId: harnessOptions.agentId, eventBus: options.eventBus,
          store: browserToolCalls, tools: input.runtimeContributions?.tools
        });
        const resolvedTools = await createRuntimeSubagentTools({
          contributionTools: [...(contribution.tools || []), ...browserTools],
          depth: harnessOptions.depth,
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
        const tools = continuationSubagentFilters?.toolFilter
          ? [...await continuationSubagentFilters.toolFilter(resolvedTools)]
          : resolvedTools;
        const loadedSkills = await loadRuntimeSkills({
          activeSkills: input.activeSkills,
          contributionSkillDirs: contribution.skillDirs,
          contributionSkills: contribution.skills,
          env,
          runtimeContributionSkills: input.runtimeContributions?.skills,
          skillDirs: options.skillDirs,
          skillsService: options.skillsService,
          tempSkillDir: options.tempSkillDir,
          workspacePath: input.workspacePath
        });
        const harnessSkills = continuationSubagentFilters?.skillFilter
          ? [...await continuationSubagentFilters.skillFilter(loadedSkills.skills)]
          : loadedSkills.skills;
        harnessSessions.set(harnessOptions.agentId, harnessOptions.session);
        harnessTools.set(harnessOptions.agentId, tools);
        const harness = await createWithMaterializedSkills(loadedSkills, () => new AgentHarness({
          activeToolNames: tools.map(tool => tool.name),
          env,
          getApiKeyAndHeaders: async (requestedModel?: Model<Api>) => {
            const apiModel = requestedModel ?? proxyController?.getActiveModel() ?? activeModel;
            const apiKey =
              (await options.getApiKey?.(apiModel.provider, apiModel.id)) ??
              getEnvApiKey(apiModel.provider);
            return apiKey ? { apiKey } : undefined;
          },
          model: contribution.model || activeModel,
          resources: { skills: harnessSkills },
          session: harnessOptions.session,
          systemPrompt: ({ resources }) =>
            [
              ...(contribution.systemPrompts || []),
              ...(input.runtimeContributions?.systemPrompts || []),
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
        }));
        harnessSkillCleanups.set(harness, loadedSkills.cleanup);
        if (proxyCandidate && options.modelProxiesService) {
          proxyController = createModelProxyRuntimeController({
            activeCandidate: proxyCandidate,
            activeModel,
            proxyModelId: input.modelId,
            resolveModel: (provider, modelId) => resolveAgentModel(provider, modelId, options.getCustomModel),
            service: options.modelProxiesService,
            setModel: async (nextModel) => {
              model = nextModel;
              activeModel = nextModel;
              await harness.setModel(nextModel);
            }
          });
        }
        const tokenCollection =
          tokenCollections.get(input.taskId) ??
          createTokenCollection(input.taskId, createRuntimeTokenCollectionOptions({
            tokenFlushIntervalMs: options.tokenFlushIntervalMs,
            tokenUsageStorageTarget: options.tokenUsageStorageTarget
          }));
        tokenCollections.set(input.taskId, tokenCollection);
        tokenCollection.appendHarness(harness);
        subscribeHarnessEvents({
          contribution,
          continueOrEndTask,
          eventBus: options.eventBus,
          finishSubagent,
          getProxyController: () => proxyController,
          harness,
          harnessOptions,
          interruptedHarnesses,
          pendingSubagentResults,
          pendingVisibleMessages,
          subagents
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
        if (subagent.independent === true) {
          subagent.consumed = true;
          subagents.delete(subagent.agentId);
          const continued = await continueOrEndTask(
            subagent.parentAgentId,
            subagent.parentAgentName,
            subagent.parentSession,
            undefined,
            { deferIfRunning: true }
          );
          if (!continued) {
            options.eventBus.emit({
              agentId: findRootAgentId(subagents, subagent.parentAgentId),
              type: "task_end"
            });
          }
          return;
        }
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
          await startHarness("", {
            agentId: harnessAgentId,
            depth: currentSubagent?.depth ?? 0,
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
          const continuationSubagentFilters = {
            ...(continuation.pluginFilter === undefined
              ? {}
              : { pluginFilter: continuation.pluginFilter }),
            ...(continuation.skillFilter === undefined
              ? {}
              : { skillFilter: continuation.skillFilter }),
            ...(continuation.toolFilter === undefined
              ? {}
              : { toolFilter: continuation.toolFilter })
          };
          await startContinuationSubagent({
            ...(continuation.agentName === undefined
              ? {}
              : { agentName: continuation.agentName }),
            ...(Object.keys(continuationSubagentFilters).length === 0
              ? {}
              : { continuationSubagentFilters }),
            eventBus: options.eventBus,
            ...(continuation.independent === true
              ? { independent: true }
              : {}),
            parentAgentId: harnessAgentId,
            parentAgentName: harnessAgentName,
            parentDepth: currentSubagent?.depth ?? 0,
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
        await startHarness("", {
          agentId: harnessAgentId,
          depth: currentSubagent?.depth ?? 0,
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
          .finally(async () => {
            await harnessSkillCleanups.get(harness)?.();
            harnessSkillCleanups.delete(harness);
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
        depth: 0,
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

function findRootAgentId(
  subagents: Map<string, SubagentRun<HarnessSession>>,
  agentId: string
): string {
  let currentAgentId = agentId;
  let currentSubagent = subagents.get(currentAgentId);

  while (currentSubagent) {
    currentAgentId = currentSubagent.parentAgentId;
    currentSubagent = subagents.get(currentAgentId);
  }

  return currentAgentId;
}
