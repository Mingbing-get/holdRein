import { createContext, useContext, useSyncExternalStore } from "react";
import type { PropsWithChildren } from "react";

import type { WebPlugin } from "@hold-rein/plugin-web";
import type { AgentMessageFetcher } from "../api";
import type { AgentMessageStore } from "../message-store";
import type {
  AgentTaskState,
  ContinueTaskInput,
  PendingApproval,
  StartTaskInput,
  SubagentState
} from "../agent-message-types";

export const EMPTY_MESSAGES: WebPlugin.AgentMessage[] = [];
export const EMPTY_MESSAGE_IDS: string[] = [];
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
  getSubagent: (agentId: string) => SubagentState | undefined;
  getSubagentMessages: (agentId: string) => WebPlugin.AgentMessage[];
  getPendingApproval: (taskId: string) => PendingApproval | undefined;
  getTaskState: (taskId: string) => AgentTaskState | undefined;
  hasPendingApproval: (taskId: string) => boolean;
  hasUnreadCompletion: (taskId: string) => boolean;
  messageStore: AgentMessageStore;
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

export function useAgentMessage(
  agentId: string,
  messageId: string
): WebPlugin.AgentMessage | undefined {
  const { messageStore } = useAgentTasks();

  return useSyncExternalStore(
    (listener) =>
      messageStore.subscribeAgentMessage(agentId, messageId, listener),
    () => messageStore.getAgentMessage(agentId, messageId),
    () => undefined
  );
}

export function useAgentMessageIds(agentId: string): string[] {
  const { messageStore } = useAgentTasks();

  return useSyncExternalStore(
    (listener) => messageStore.subscribeAgentMessageIds(agentId, listener),
    () => messageStore.getAgentMessageIds(agentId),
    () => EMPTY_MESSAGE_IDS
  );
}

export function useAgentMessages(agentId: string): WebPlugin.AgentMessage[] {
  const { messageStore } = useAgentTasks();

  return useSyncExternalStore(
    (listener) => messageStore.subscribeAgentMessageIds(agentId, listener),
    () => messageStore.getAgentMessages(agentId),
    () => EMPTY_MESSAGES
  );
}

export function useToolResultMessage(
  agentId: string,
  toolCallId: string
): WebPlugin.ToolResultMessage | undefined {
  const { messageStore } = useAgentTasks();

  return useSyncExternalStore(
    (listener) => messageStore.subscribeToolResult(agentId, toolCallId, listener),
    () => messageStore.getToolResult(agentId, toolCallId),
    () => undefined
  );
}
