import type {
  AgentMessage,
  AgentHarnessEvent,
  Skill,
  AgentTool,
  ExecutionEnv,
  Session,
  ThinkingLevel,
  ToolCallEvent,
  ToolCallResult
} from "@earendil-works/pi-agent-core";

import type { Model, Api } from "@earendil-works/pi-ai";

import type { Router, Response } from "express";

export namespace ServerPlugin {
  // 接口相关
  interface ResponseCodeDefinition {
    code: number;
    defaultMessage: string;
    description: string;
    httpStatus: number;
  }
  
  type RseponseType = "success" | "badRequest" | "unauthorized" | "forbidden" | "notFound" | "conflict" | "internalError"

  export interface RouteContext {
    RESPONSE_CODE_DEFINITIONS: Record<RseponseType, ResponseCodeDefinition>
    sendSuccess: <T>(response: Response, data: T, message?: string) => void
    sendError(response: Response, definition: ResponseCodeDefinition, message?: string): void
  }

  // 模型相关

  export interface RuntimeContext {
    readonly agentName: string;
    readonly env: ExecutionEnv;
    readonly isContinue: boolean;
    readonly session: Session;
    readonly model: Model<Api>;
    readonly thinkingLevel: ThinkingLevel;
    readonly prompt: string;
    readonly taskId: string;
  }

  export interface AgentSessionMetadata {
    readonly createdAt: string;
    readonly id: string;
    readonly path: string;
  }

  export interface RunAgentInput {
    readonly modelId: string;
    readonly prompt: string;
    readonly provider: string;
    readonly session?: AgentSessionMetadata;
    readonly taskId: string;
    readonly workspacePath: string;
  }

  export interface AgentEndInput {
    readonly messages: readonly AgentMessage[];
    readonly runInput: RunAgentInput;
    readonly session: AgentSessionMetadata;
  }

  export interface AgentContinuation {
    readonly agentName?: string;
    readonly details?: unknown;
    /**
     * Only applies when useSubagent is true. When true, the subagent runs to
     * completion without appending its result back to the parent agent context.
     */
    readonly independent?: boolean;
    readonly pluginFilter?: AgentContinuationPluginFilter;
    readonly prompt: string;
    readonly skillFilter?: AgentContinuationSkillFilter;
    readonly toolFilter?: AgentContinuationToolFilter;
    readonly useSubagent?: boolean;
  }

  export type AgentContinuationPluginFilter = (
    plugins: Plugin[]
  ) => Plugin[] | Promise<Plugin[]>;

  export type AgentContinuationSkillFilter = (
    skills: Skill[]
  ) => Skill[] | Promise<Skill[]>;

  export type AgentContinuationToolFilter = (
    tools: PluginTool[]
  ) => PluginTool[] | Promise<PluginTool[]>;

  export type ToolBeforeExecuteResult = ToolCallResult | undefined;

  export interface ToolBeforeExecuteOptions {
    readonly workspacePath: string;
    readonly event: ToolCallEvent;
    readonly requestApproval: (
      title?: string
    ) => Promise<ToolBeforeExecuteResult>;
  }

  export interface PluginTool extends AgentTool {
    beforeExecute?: (
      options: ToolBeforeExecuteOptions
    ) => ToolBeforeExecuteResult | Promise<ToolBeforeExecuteResult>;
  }

  export interface SkillReference {
    readonly content: string;
    /** Path relative to the materialized skill's references directory. */
    readonly path: string;
  }

  export interface InlineSkill {
    readonly content: string;
    readonly description?: string;
    readonly name: string;
    readonly references?: readonly SkillReference[];
  }

  export interface Contribution
    extends Partial<Pick<RuntimeContext, "model" | "thinkingLevel">> {
    readonly tools?: PluginTool[];
    /**
     * 会自动加载skillDirs下所有的skill，会合并skills
     */
    readonly skills?: readonly InlineSkill[];
    readonly skillDirs?: readonly string[];
    readonly systemPrompts?: readonly string[];
    readonly subscribe?: (event: AgentHarnessEvent) => void;
    readonly agentEndPriority?: number;
    readonly onAgentEnd?: (
      input: AgentEndInput
    ) => AgentContinuation | undefined | Promise<AgentContinuation | undefined>;
  }

  export type ContributionResolver =
    | Contribution
    | ((context: RuntimeContext) => Contribution | Promise<Contribution>);

  export interface Plugin {
    readonly id: string
    readonly packageName?: string
    readonly contributionResolver?: ContributionResolver
    readonly dispose?: () => void | Promise<void>
    readonly registerRoutes?: (context: RouteContext) => Router | Promise<Router>;
  }
}

export type RuntimeWebEntryType = "umd" | "module";

export interface PackageEntryManifest {
  readonly compatibleHost?: string;
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly serverEntry: string;
  readonly version: string;
  readonly webEntry?: string;
  readonly webStyle?: string;
}

export interface RuntimePluginManifest {
  readonly dev?: boolean;
  readonly disabled?: boolean;
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly webEntry: string;
  readonly webEntryType?: RuntimeWebEntryType;
  readonly webStyle?: string;
}
