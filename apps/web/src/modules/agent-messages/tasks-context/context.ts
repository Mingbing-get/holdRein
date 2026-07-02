import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";

import type { WebPlugin } from "@hold-rein/plugin-web";
import type { AgentMessageFetcher } from "../api";
import type {
  AgentTaskState,
  ContinueTaskInput,
  PendingApproval,
  StartTaskInput,
  SubagentStatesById
} from "../agent-message-types";

export const EMPTY_MESSAGES: WebPlugin.AgentMessage[] = [];
export const EMPTY_RUNTIME_CONTRIBUTIONS: WebPlugin.ResolvedBrowserRuntimeContributions =
  { skills: [], systemPrompts: [], tools: [] };

export interface AgentTasksContextValue {
  cancelTask: (taskId: string) => Promise<void>;
  continueTask: (taskId: string, input: ContinueTaskInput) => Promise<void>;
  decideApproval: (
    taskId: string,
    approvalId: string,
    approved: boolean,
    reason?: string
  ) => Promise<void>;
  getSubagentMessages: (agentId: string) => WebPlugin.AgentMessage[];
  getSubagentStatus: (
    agentId: string
  ) => SubagentStatesById[string]["status"] | undefined;
  getPendingApproval: (taskId: string) => PendingApproval | undefined;
  getTaskState: (taskId: string) => AgentTaskState | undefined;
  hasPendingApproval: (taskId: string) => boolean;
  hasUnreadCompletion: (taskId: string) => boolean;
  startTask: (input: StartTaskInput) => Promise<void>;
}

export interface AgentTasksProviderProps extends PropsWithChildren {
  apiBaseUrl: string;
  fetcher?: AgentMessageFetcher;
}

export const AgentTasksContext = createContext<AgentTasksContextValue | null>(
  null
);

export function useAgentTasks(): AgentTasksContextValue {
  const value = useContext(AgentTasksContext);

  if (!value) {
    throw new Error("useAgentTasks must be used within an AgentTasksProvider");
  }

  return value;
}
