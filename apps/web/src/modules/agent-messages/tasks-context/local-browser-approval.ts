import type { Dispatch, SetStateAction } from "react";

import type { WebPlugin } from "@hold-rein/plugin-web";

import type {
  AgentTaskState,
  PendingApproval
} from "../agent-message-types";
import {
  createInitialAgentTaskState,
  reduceAgentTaskState
} from "../reducer";

export type LocalApprovalResolver = (
  result: WebPlugin.BrowserToolBeforeExecuteResult
) => void;

export function requestLocalBrowserApproval(input: {
  approval: PendingApproval;
  resolvers: Map<string, LocalApprovalResolver>;
  setTaskStates: Dispatch<SetStateAction<Record<string, AgentTaskState>>>;
  taskId: string;
}): Promise<WebPlugin.BrowserToolBeforeExecuteResult> {
  return new Promise((resolve) => {
    input.resolvers.set(input.approval.approvalId, resolve);
    input.setTaskStates((current) => ({
      ...current,
      [input.taskId]: reduceAgentTaskState(
        current[input.taskId] ?? createInitialAgentTaskState(input.taskId),
        { approval: input.approval, type: "local_approval_requested" }
      )
    }));
  });
}

export function decideLocalBrowserApproval(input: {
  approval: PendingApproval;
  approvalId: string;
  approved: boolean;
  reason?: string;
  resolvers: Map<string, LocalApprovalResolver>;
  setTaskStates: Dispatch<SetStateAction<Record<string, AgentTaskState>>>;
  taskId: string;
}): boolean {
  const localResolver = input.resolvers.get(input.approvalId);
  if (!localResolver) return false;

  input.resolvers.delete(input.approvalId);
  localResolver(
    input.approved
      ? undefined
      : {
          block: true,
          reason:
            input.reason?.trim() ||
            `User denied execute tool: ${input.approval.tool.name}`
        }
  );
  input.setTaskStates((current) => ({
    ...current,
    [input.taskId]: reduceAgentTaskState(
      current[input.taskId] ?? createInitialAgentTaskState(input.taskId),
      { approvalId: input.approvalId, type: "approval_decided" }
    )
  }));
  return true;
}
