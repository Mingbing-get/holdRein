import type { AgentApprovalStore } from "../approval/store";
import type { AgentEventEnvelope } from "../agent-types";

export function addApprovalStatus(
  event: AgentEventEnvelope,
  approvalStore: AgentApprovalStore
): AgentEventEnvelope {
  if (event.type !== "approval_requested") return event;
  const payload =
    event.payload && typeof event.payload === "object"
      ? (event.payload as Record<string, unknown>)
      : undefined;
  if (
    typeof payload?.agentId !== "string" ||
    typeof payload.approvalId !== "string"
  ) {
    return event;
  }

  const status = approvalStore.getStatus({
    agentId: payload.agentId,
    approvalId: payload.approvalId
  });
  if (!status) return event;

  return {
    ...event,
    payload: {
      ...payload,
      ...status
    }
  };
}
