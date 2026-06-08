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
  startAgent: (input: StartAgentInput) => Promise<StartAgentResult>;
  subscribeToAgentEvents: (
    input: SubscribeAgentEventsInput,
    listener: AgentEventListener
  ) => AgentEventSubscription;
}

export interface GetTaskTitleInput {
  taskId: string;
}

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
          modelId: task.lastModelName,
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
      const task = options.repository.createTask({
        createdAt,
        id: `task_${randomUUID()}`,
        initialUserMessage: input.prompt,
        lastContinuedAt: createdAt,
        lastModelName: configuredModel?.model.name ?? input.modelId,
        lastModelProvider: input.provider,
        lastModelProviderSource: options.modelProvidersService?.hasProvider(input.provider)
          ? getProviderSource(input.provider, options.modelProvidersService)
          : "built_in",
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

      const run = await options.runtime.start(input);

      return {
        ...run,
        task,
        workspace
      };
    },
    subscribeToAgentEvents: (input, listener) =>
      options.eventBus.subscribe(input, listener)
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
