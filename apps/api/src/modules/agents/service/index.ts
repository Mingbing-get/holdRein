/* eslint-disable max-lines */
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import type { TaskRow, WorkspaceRow } from "../../../db";
import type { ModelProvidersService } from "../../model-providers/model-providers-service";
import type { WorkspaceRepository } from "../../workspaces/workspace-repository";
import type { AgentApprovalStore } from "../approval/store";
import type { ActiveTaskRunRegistry } from "../task/active-run-registry";
import type { AgentEventBus, AgentEventListener } from "../event/event-bus";
import type { AgentRuntime } from "../runtime/type";
import type { TaskTitleGenerator } from "../task/title-generator";
import { deleteTask, type DeleteTaskResult, renameTask } from "../task/actions";
import { startTaskRun } from "../task/run-monitor";
import { interruptTaskRun } from "./interrupt-task";
import type {
  AgentEventSubscription,
  AgentSessionMetadata,
  ApprovalPolicy,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  BrowserRuntimeContributions,
  BrowserToolResultInput,
  StoredAgentMessage,
  InterruptTaskResult,
  StartAgentInput,
  StartAgentResult,
  SubscribeAgentEventsInput,
  TaskMessageHistory,
  ThinkingLevel,
  TaskTitleResult
} from "../agent-types";
import {
  createInMemorySubagentRepository,
  type SubagentRepository
} from "../subagent/repository";
import { resolveWorkspaceCapabilities } from "./workspace-settings";

export interface AgentsService {
  approveAgentAction: (
    input: ApprovalDecisionInput
  ) => Promise<ApprovalDecisionResult>;
  deleteTask: (input: GetTaskTitleInput) => Promise<DeleteTaskResult>;
  getTaskTitle: (input: GetTaskTitleInput) => Promise<TaskTitleResult | null>;
  interruptTask: (input: GetTaskTitleInput) => Promise<InterruptTaskResult>;
  continueTask: (input: ContinueTaskInput) => Promise<StartAgentResult | null>;
  listTaskMessages: (input: GetTaskTitleInput) => Promise<TaskMessageHistory>;
  renameTask: (input: RenameTaskInput) => Promise<TaskTitleResult | null>;
  startAgent: (input: StartAgentInput) => Promise<StartAgentResult>;
  submitBrowserToolResult: (
    input: BrowserToolResultInput
  ) => Promise<BrowserToolResultInput | null>;
  subscribeToAgentEvents: (
    input: SubscribeAgentEventsInput,
    listener: AgentEventListener
  ) => AgentEventSubscription;
}

export interface GetTaskTitleInput {
  taskId: string;
}

export interface RenameTaskInput extends GetTaskTitleInput {
  title: string;
}

interface ContinueTaskBaseInput {
  activePlugins?: readonly string[];
  activeSkills?: readonly string[];
  approvalPolicy?: ApprovalPolicy;
  prompt: string;
  runtimeContributions?: BrowserRuntimeContributions;
  thinkingLevel?: ThinkingLevel;
  taskId: string;
}

export type ContinueTaskInput = ContinueTaskBaseInput &
  (
    | { modelId: string; provider: string }
    | { modelId?: never; provider?: never }
  );

export interface CreateAgentsServiceOptions {
  activeTaskRuns?: ActiveTaskRunRegistry;
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  modelProvidersService?: ModelProvidersService;
  now?: () => Date;
  repository: WorkspaceRepository;
  runtime: AgentRuntime;
  subagentRepository?: SubagentRepository;
  titleGenerator: TaskTitleGenerator;
}

export function createAgentsService(options: CreateAgentsServiceOptions): AgentsService {
  const titleJobs = new Map<string, Promise<TaskTitleResult>>();
  const now = options.now ?? (() => new Date());
  const subagentRepository =
    options.subagentRepository ?? createInMemorySubagentRepository();

  return {
    approveAgentAction: async (input) => {
      if (!options.approvalStore.decide(input)) {
        throw new Error("Unknown approval request");
      }

      return input;
    },
    deleteTask: ({ taskId }) =>
      deleteTask(options.repository, taskId, subagentRepository),
    getTaskTitle: async ({ taskId }) => {
      const task = options.repository.findTaskById(taskId);

      if (!task) {
        return null;
      }

      if (task.title.trim().length > 0) {
        return { id: task.id, title: task.title };
      }

      const titleJob = titleJobs.get(task.id);

      if (titleJob) {
        return titleJob;
      }
      startTitleJob({
        input: {
          approvalPolicy: task.approvalPolicy,
          modelId: task.lastModelId ?? task.lastModelName,
          prompt: task.initialUserMessage,
          provider: task.lastModelProvider,
          thinkingLevel: task.thinkingLevel,
          workspacePath: ""
        },
        now,
        repository: options.repository,
        task,
        titleGenerator: options.titleGenerator,
        titleJobs
      });

      return titleJobs.get(task.id) ?? { id: task.id, title: task.title };
    },
    interruptTask: async ({ taskId }) => {
      return interruptTaskRun({
        ...(options.activeTaskRuns
          ? { activeTaskRuns: options.activeTaskRuns }
          : {}),
        now,
        repository: options.repository,
        runtime: options.runtime,
        subagentRepository,
        taskId
      });
    },
    continueTask: async (input) => {
      const { prompt, taskId } = input;
      const task = options.repository.findTaskById(taskId);
      if (!task) return null;
      const workspace = options.repository.findWorkspaceById(task.workspaceId);
      if (!workspace) return null;
      const session = getTaskSession(task);
      const selectedModel =
        input.modelId !== undefined && input.provider !== undefined
          ? getTaskModelMetadata(
              input.provider,
              input.modelId,
              options.modelProvidersService
            )
          : null;
      const optionUpdate = {
        approvalPolicy: input.approvalPolicy ?? task.approvalPolicy,
        thinkingLevel: input.thinkingLevel ?? task.thinkingLevel
      };
      const workspaceCapabilities = await resolveWorkspaceCapabilities({
        activePlugins: input.activePlugins,
        activeSkills: input.activeSkills,
        workspacePath: workspace.path
      });
      options.repository.updateTaskOptions(
        taskId,
        optionUpdate,
        now().toISOString()
      );
      options.repository.updateTaskStatus(taskId, "running", now().toISOString());
      const run = await startTaskRun({
        ...(options.activeTaskRuns
          ? { activeTaskRuns: options.activeTaskRuns }
          : {}),
        eventBus: options.eventBus,
        now,
        repository: options.repository,
        runtime: options.runtime,
        runtimeInput: {
          modelId:
            selectedModel?.lastModelId ?? task.lastModelId ?? task.lastModelName,
          prompt,
          provider: selectedModel?.lastModelProvider ?? task.lastModelProvider,
          ...optionUpdate,
          ...workspaceCapabilities,
          ...(input.runtimeContributions === undefined
            ? {}
            : { runtimeContributions: input.runtimeContributions }),
          ...(session ? { session } : {}),
          taskId,
          workspacePath: workspace.path
        },
        taskId
      });
      options.repository.updateTaskSession(taskId, run.session);
      const continuedAt = now().toISOString();
      if (selectedModel) {
        options.repository.updateTaskModel(taskId, selectedModel, continuedAt);
      }
      const updatedTask = options.repository.updateTaskContinuedAt(
        taskId,
        continuedAt
      ) ?? task;

      return toStartAgentResult(run, updatedTask, workspace);
    },
    listTaskMessages: async ({ taskId }) => {
      const task = options.repository.findTaskById(taskId);
      if (!task) return emptyTaskMessageHistory();
      const workspace = options.repository.findWorkspaceById(task.workspaceId);
      const session = getTaskSession(task);
      if (!workspace || !session) return emptyTaskMessageHistory();

      const messages = await options.runtime.listMessages({
        session,
        workspacePath: workspace.path
      });
      const subagents = await Promise.all(
        subagentRepository.findByTaskId(taskId).map(async (subagent) => ({
          agentId: subagent.agentId,
          agentName: subagent.agentName,
          messages: await loadSubagentMessages({
            runtime: options.runtime,
            subagent,
            workspacePath: workspace.path
          }),
          parentAgentId: subagent.parentAgentId,
          status: subagent.status
        }))
      );

      return { messages, subagents };
    },
    renameTask: async ({ taskId, title }) =>
      renameTask(
        options.repository,
        taskId,
        title,
        now().toISOString()
      ),
    startAgent: async (input) => {
      const taskOptions = getTaskRunOptions(input);
      const createdAt = now().toISOString();
      const workspace = ensureWorkspace({
        createdAt,
        repository: options.repository,
        workspacePath: input.workspacePath
      });
      const workspaceCapabilities = await resolveWorkspaceCapabilities(input);
      const configuredModel =
        options.modelProvidersService?.getConfiguredModelForProvider(
          input.provider,
          input.modelId
        ) ?? null;
      const taskModel = getTaskModelMetadata(
        input.provider,
        input.modelId,
        options.modelProvidersService
      );
      const task = options.repository.createTask({
        createdAt,
        id: `task_${randomUUID()}`,
        initialUserMessage: input.prompt,
        lastContinuedAt: createdAt,
        ...taskModel,
        approvalPolicy: taskOptions.approvalPolicy,
        sessionCreatedAt: null,
        sessionId: null,
        sessionPath: null,
        sourceMark:
          input.source?.type === "scheduled" ? input.source.mark ?? null : null,
        sourceType: input.source?.type ?? "manual",
        status: "running",
        thinkingLevel: taskOptions.thinkingLevel,
        title: "",
        updatedAt: createdAt,
        workspaceId: workspace.id
      });

      startTitleJob({
        ...(configuredModel?.apiKey ? { apiKey: configuredModel.apiKey } : {}),
        input,
        now,
        repository: options.repository,
        task,
        titleGenerator: options.titleGenerator,
        titleJobs
      });

      const run = await startTaskRun({
        ...(options.activeTaskRuns
          ? { activeTaskRuns: options.activeTaskRuns }
          : {}),
        eventBus: options.eventBus,
        now,
        repository: options.repository,
        runtime: options.runtime,
        runtimeInput: {
          ...input,
          ...taskOptions,
          ...workspaceCapabilities,
          taskId: task.id
        },
        taskId: task.id
      });
      const updatedTask = options.repository.updateTaskSession(task.id, run.session) ?? task;

      return toStartAgentResult(run, updatedTask, workspace);
    },
    submitBrowserToolResult: async (input) => {
      const accepted =
        (await options.runtime.submitBrowserToolResult?.(input)) ?? false;
      return accepted ? input : null;
    },
    subscribeToAgentEvents: (input, listener) =>
      options.eventBus.subscribe(input, listener)
  };
}

function getTaskRunOptions(input: {
  approvalPolicy?: ApprovalPolicy;
  thinkingLevel?: ThinkingLevel;
}): Pick<TaskRow, "approvalPolicy" | "thinkingLevel"> {
  return {
    approvalPolicy: input.approvalPolicy ?? "approval",
    thinkingLevel: input.thinkingLevel ?? "medium"
  };
}

function emptyTaskMessageHistory(): TaskMessageHistory {
  return { messages: [], subagents: [] };
}

async function loadSubagentMessages(input: {
  runtime: AgentRuntime;
  subagent: ReturnType<SubagentRepository["findByTaskId"]>[number];
  workspacePath: string;
}): Promise<StoredAgentMessage[]> {
  const session = getSubagentSession(input.subagent);
  if (!session) return [];

  try {
    return await input.runtime.listMessages({
      session,
      workspacePath: input.workspacePath
    });
  } catch {
    return [];
  }
}

function getSubagentSession(
  subagent: ReturnType<SubagentRepository["findByTaskId"]>[number]
): AgentSessionMetadata | undefined {
  if (!subagent.sessionCreatedAt || !subagent.sessionId || !subagent.sessionPath) {
    return undefined;
  }

  return {
    createdAt: subagent.sessionCreatedAt,
    id: subagent.sessionId,
    path: subagent.sessionPath
  };
}

function getTaskSession(task: TaskRow) {
  if (!task.sessionId || !task.sessionPath || !task.sessionCreatedAt) {
    return undefined;
  }

  return {
    createdAt: task.sessionCreatedAt,
    id: task.sessionId,
    path: task.sessionPath
  };
}

function toStartAgentResult(
  run: Awaited<ReturnType<AgentRuntime["start"]>>,
  task: TaskRow,
  workspace: WorkspaceRow
): StartAgentResult {
  return {
    agentId: run.agentId,
    sessionId: run.session.id,
    status: run.status,
    task,
    workspace
  };
}

function ensureWorkspace(input: {
  createdAt: string;
  repository: WorkspaceRepository;
  workspacePath: string;
}): WorkspaceRow {
  const existingWorkspace = input.repository.findWorkspaceByPath(
    input.workspacePath
  );

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const name = basename(input.workspacePath) || input.workspacePath;

  return input.repository.createWorkspace({
    createdAt: input.createdAt,
    id: `workspace_${randomUUID()}`,
    name,
    path: input.workspacePath,
    updatedAt: input.createdAt
  });
}

function getProviderSource(
  provider: string,
  modelProvidersService: ModelProvidersService
): TaskRow["lastModelProviderSource"] {
  const summary = modelProvidersService
    .listModelProviders()
    .find((item) => item.id === provider);

  return summary?.source === "custom" ? "custom" : "built_in";
}

function getTaskModelMetadata(
  provider: string,
  modelId: string,
  modelProvidersService?: ModelProvidersService
): Pick<
  TaskRow,
  "lastModelId" | "lastModelName" | "lastModelProvider" | "lastModelProviderSource"
> {
  const configuredModel =
    modelProvidersService?.getConfiguredModelForProvider(provider, modelId) ?? null;

  return {
    lastModelId: modelId,
    lastModelName: configuredModel?.model.name ?? modelId,
    lastModelProvider: provider,
    lastModelProviderSource:
      modelProvidersService?.hasProvider(provider)
        ? getProviderSource(provider, modelProvidersService)
        : "built_in"
  };
}

function startTitleJob(input: {
  apiKey?: string;
  input: StartAgentInput;
  now: () => Date;
  repository: WorkspaceRepository;
  task: TaskRow;
  titleGenerator: TaskTitleGenerator;
  titleJobs: Map<string, Promise<TaskTitleResult>>;
}): void {
  const titleJob = input.titleGenerator
    .generateTitle({
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      modelId: input.input.modelId,
      prompt: input.input.prompt,
      provider: input.input.provider
    })
    .then((title) => {
      const currentTask = input.repository.findTaskById(input.task.id);

      if (!currentTask || currentTask.title.trim().length > 0) {
        return { id: input.task.id, title: currentTask?.title ?? title };
      }

      const updatedTask = input.repository.updateTaskTitle(
        input.task.id, title, input.now().toISOString()
      );

      return { id: input.task.id, title: updatedTask?.title ?? title };
    })
    .finally(() => {
      input.titleJobs.delete(input.task.id);
    });

  input.titleJobs.set(input.task.id, titleJob);
}
