import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import type { TaskRow, WorkspaceRow } from "../../db";
import type { ModelProvidersService } from "../model-providers/model-providers-service";
import type { WorkspaceRepository } from "../workspaces/workspace-repository";
import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus, AgentEventListener } from "./agent-event-bus";
import type { AgentRuntime } from "./agent-runtime";
import type { TaskTitleGenerator } from "./agent-task-title-generator";
import type {
  AgentEventSubscription,
  ApprovalDecisionInput,
  ApprovalDecisionResult,
  StoredAgentMessage,
  StartAgentInput,
  StartAgentResult,
  SubscribeAgentEventsInput,
  TaskTitleResult
} from "./agent-types";

export interface AgentsService {
  approveAgentAction: (
    input: ApprovalDecisionInput
  ) => Promise<ApprovalDecisionResult>;
  getTaskTitle: (input: GetTaskTitleInput) => Promise<TaskTitleResult | null>;
  continueTask: (input: ContinueTaskInput) => Promise<StartAgentResult | null>;
  listTaskMessages: (input: GetTaskTitleInput) => Promise<StoredAgentMessage[]>;
  startAgent: (input: StartAgentInput) => Promise<StartAgentResult>;
  subscribeToAgentEvents: (
    input: SubscribeAgentEventsInput,
    listener: AgentEventListener
  ) => AgentEventSubscription;
}

export interface GetTaskTitleInput {
  taskId: string;
}

interface ContinueTaskBaseInput {
  prompt: string;
  taskId: string;
}

export type ContinueTaskInput = ContinueTaskBaseInput &
  (
    | { modelId: string; provider: string }
    | { modelId?: never; provider?: never }
  );

export interface CreateAgentsServiceOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  modelProvidersService?: ModelProvidersService;
  now?: () => Date;
  repository: WorkspaceRepository;
  runtime: AgentRuntime;
  titleGenerator: TaskTitleGenerator;
}

export function createAgentsService(
  options: CreateAgentsServiceOptions
): AgentsService {
  const titleJobs = new Map<string, Promise<TaskTitleResult>>();
  const now = options.now ?? (() => new Date());

  return {
    approveAgentAction: async (input) => {
      if (!options.approvalStore.decide(input)) {
        throw new Error("Unknown approval request");
      }

      return input;
    },
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
          modelId: task.lastModelId ?? task.lastModelName,
          prompt: task.initialUserMessage,
          provider: task.lastModelProvider,
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
      const run = await options.runtime.start({
        modelId: selectedModel?.lastModelId ?? task.lastModelId ?? task.lastModelName,
        prompt,
        provider: selectedModel?.lastModelProvider ?? task.lastModelProvider,
        ...(session ? { session } : {}),
        taskId,
        workspacePath: workspace.path
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
      if (!task) return [];
      const workspace = options.repository.findWorkspaceById(task.workspaceId);
      const session = getTaskSession(task);
      if (!workspace || !session) return [];

      return options.runtime.listMessages({
        session,
        workspacePath: workspace.path
      });
    },
    startAgent: async (input) => {
      const createdAt = now().toISOString();
      const workspace = ensureWorkspace({
        createdAt,
        repository: options.repository,
        workspacePath: input.workspacePath
      });
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
        sessionCreatedAt: null,
        sessionId: null,
        sessionPath: null,
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

      const run = await options.runtime.start({ ...input, taskId: task.id });
      const updatedTask = options.repository.updateTaskSession(task.id, run.session) ?? task;

      return toStartAgentResult(run, updatedTask, workspace);
    },
    subscribeToAgentEvents: (input, listener) =>
      options.eventBus.subscribe(input, listener)
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
      const updatedTask = input.repository.updateTaskTitle(
        input.task.id,
        title,
        input.now().toISOString()
      );

      return {
        id: input.task.id,
        title: updatedTask?.title ?? title
      };
    })
    .finally(() => {
      input.titleJobs.delete(input.task.id);
    });

  input.titleJobs.set(input.task.id, titleJob);
}
