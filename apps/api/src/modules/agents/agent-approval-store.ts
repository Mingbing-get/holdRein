import type {
  ApprovalDecisionInput,
  ShellCommandApprovalRequest
} from "./agent-types";

export interface AgentApprovalStore {
  decide: (input: ApprovalDecisionInput) => boolean;
  request: (request: ShellCommandApprovalRequest) => Promise<boolean>;
}

interface PendingApproval {
  agentId: string;
  resolve: (approved: boolean) => void;
}

export function createAgentApprovalStore(): AgentApprovalStore {
  const pendingApprovals = new Map<string, PendingApproval>();

  return {
    decide: (input) => {
      const pending = pendingApprovals.get(input.approvalId);

      if (!pending || pending.agentId !== input.agentId) {
        return false;
      }

      pendingApprovals.delete(input.approvalId);
      pending.resolve(input.approved);

      return true;
    },
    request: (request) =>
      new Promise<boolean>((resolve) => {
        pendingApprovals.set(request.approvalId, {
          agentId: request.agentId,
          resolve
        });
      })
  };
}
