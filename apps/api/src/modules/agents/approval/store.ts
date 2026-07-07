import type {
  ApprovalDecision,
  ApprovalDecisionInput,
  ToolApprovalRequest
} from "../agent-types";

export type ApprovalStatus =
  | { status: "pending" }
  | ({ status: "decided" } & ApprovalDecision);

export interface AgentApprovalStore {
  decide: (input: ApprovalDecisionInput) => boolean;
  getStatus: (input: {
    agentId: string;
    approvalId: string;
  }) => ApprovalStatus | undefined;
  request: (request: ToolApprovalRequest) => Promise<ApprovalDecision>;
}

interface PendingApproval {
  agentId: string;
  resolve: (decision: ApprovalDecision) => void;
}

export function createAgentApprovalStore(): AgentApprovalStore {
  const pendingApprovals = new Map<string, PendingApproval>();
  const decidedApprovals = new Map<string, ApprovalDecision>();

  return {
    decide: (input) => {
      const key = createApprovalKey(input);
      const pending = pendingApprovals.get(key);

      if (!pending || pending.agentId !== input.agentId) {
        return false;
      }

      const decision = {
        approved: input.approved,
        ...(input.reason === undefined ? {} : { reason: input.reason })
      };
      pendingApprovals.delete(key);
      decidedApprovals.set(key, decision);
      pending.resolve(decision);

      return true;
    },
    getStatus: (input) => {
      const key = createApprovalKey(input);
      const decision = decidedApprovals.get(key);
      if (decision) return { ...decision, status: "decided" };
      return pendingApprovals.has(key) ? { status: "pending" } : undefined;
    },
    request: (request) =>
      new Promise<ApprovalDecision>((resolve) => {
        pendingApprovals.set(createApprovalKey(request), {
          agentId: request.agentId,
          resolve
        });
      })
  };
}

function createApprovalKey(input: {
  agentId: string;
  approvalId: string;
}): string {
  return `${input.agentId}:${input.approvalId}`;
}
