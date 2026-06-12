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

import type { Router } from "express";

export namespace ServerPlugin {
  export interface RouteContext {}

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
