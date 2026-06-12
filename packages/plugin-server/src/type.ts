import type {
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
    RESPONSE_CODE_DEFINITIONS: {
      [K in RseponseType]: ResponseCodeDefinition
    }
    sendSuccess: <T>(response: Response, data: T, message?: string) => void
    sendError(response: Response, definition: ResponseCodeDefinition, message?: string): void
  }

  // 模型相关

  export interface RuntimeContext {
    readonly env: ExecutionEnv;
    readonly session: Session;
    readonly model: Model<Api>;
    readonly thinkingLevel: ThinkingLevel;
    readonly prompt: string;
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
