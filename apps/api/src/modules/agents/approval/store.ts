import type {
  ApprovalDecision,
  ApprovalDecisionInput,
  ToolApprovalRequest
} from "../agent-types";

export interface AgentApprovalStore {
  decide: (input: ApprovalDecisionInput) => boolean;
  request: (request: ToolApprovalRequest) => Promise<ApprovalDecision>;
}

interface PendingApproval {
  agentId: string;
  resolve: (decision: ApprovalDecision) => void;
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
      pending.resolve({
        approved: input.approved,
        ...(input.reason === undefined ? {} : { reason: input.reason })
      });

      return true;
    },
    request: (request) =>
      new Promise<ApprovalDecision>((resolve) => {
        pendingApprovals.set(request.approvalId, {
          agentId: request.agentId,
          resolve
        });
      })
  };
}
