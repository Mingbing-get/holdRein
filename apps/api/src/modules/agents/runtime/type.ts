import type { AgentHarness, JsonlSessionRepoApi } from "@earendil-works/pi-agent-core/node";
import type { ServerPlugin } from "@hold-rein/plugin-server";
import type { AppDatabase } from "../../../db";
import type {
  AgentRunResult,
  AgentSessionMetadata,
  BrowserToolResultInput,
  StoredAgentMessage,
  RunAgentInput
} from "../agent-types";
import type { AgentApprovalStore } from "../approval/store";
import type { AgentEventBus } from "../event/event-bus";
import type { AgentModelLookup } from '../model/resolver'
import type { ModelProxiesService } from "../../model-proxies/model-proxies-service";
import type { SkillsService } from "../../skills";
import type { SubagentRepository } from "../subagent/repository";
import type { TokenUsageStorageTarget } from "./token-collection";

export interface AgentRuntime {
  interrupt: (agentId: string) => Promise<boolean>;
  listMessages: (input: { session: AgentSessionMetadata; workspacePath: string }) => Promise<StoredAgentMessage[]>;
  start: (input: RunAgentInput) => Promise<AgentRunResult>;
  submitBrowserToolResult?: (input: BrowserToolResultInput) => Promise<boolean>;
}

export interface CreateAgentRuntimeOptions {
  approvalStore: AgentApprovalStore;
  eventBus: AgentEventBus;
  getApiKey?: (provider: string, modelId: string) => Promise<string | undefined>;
  getCustomModel?: AgentModelLookup;
  modelProxiesService?: ModelProxiesService;
  sessionRepo?: JsonlSessionRepoApi;
  skillDirs?: string[];
  skillsService?: SkillsService;
  subagentDatabase?: AppDatabase;
  subagentRepository: SubagentRepository;
  tempSkillDir?: string;
  tokenFlushIntervalMs?: number;
  tokenUsageStorageTarget?: TokenUsageStorageTarget;
}

export interface RunningAgent { harness: AgentHarness; sessionId: string }

export type HarnessSession = Awaited<ReturnType<JsonlSessionRepoApi["create"]>>;

export type ContinuationSubagentFilters = Pick<
  ServerPlugin.AgentContinuation,
  "pluginFilter" | "skillFilter" | "toolFilter"
>;

export interface StartHarnessOptions {
  agentId?: string;
  agentName?: string;
  continuationSubagentFilters?: ContinuationSubagentFilters;
  depth: number;
  isContinue: boolean;
  parentAgentId?: string;
  pluginPrompt: string;
  session?: HarnessSession;
}

export type CreateHarnessOptions = StartHarnessOptions & {
  agentId: string;
  session: HarnessSession;
};

export interface PendingVisibleCustomMessage { content: string; customType: string; details?: unknown }

export interface StartHarnessResult { agentId: string; harnessSession: HarnessSession; session: AgentSessionMetadata }
