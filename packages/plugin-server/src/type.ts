import type {
  AgentMessage,
  AgentHarnessEvent,
  AgentTool,
  ExecutionEnv,
  Session,
  Skill,
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
    readonly prompt: string;
    readonly useSubagent?: boolean;
  }

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

  export interface Contribution
    extends Partial<Pick<RuntimeContext, "model" | "thinkingLevel">> {
    readonly tools?: PluginTool[];
    /**
     * 会自动加载skillDirs下所有的skill，会合并skills
     */
    readonly skills?: readonly Skill[];
    readonly skillDirs?: readonly string[];
    readonly systemPrompts?: readonly string[];
    readonly subscribe?: (event: AgentHarnessEvent) => void;
    readonly onAgentEnd?: (
      input: AgentEndInput
    ) => AgentContinuation | undefined | Promise<AgentContinuation | undefined>;
  }

  export type ContributionResolver =
    | Contribution
    | ((context: RuntimeContext) => Contribution | Promise<Contribution>);

  export interface Plugin {
    readonly id: string
    readonly contributionResolver?: ContributionResolver
    readonly registerRoutes?: (context: RouteContext) => Router | Promise<Router>;
  }
}
