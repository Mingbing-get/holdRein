import { describe, expect, it } from "vitest";

import { createAgentApprovalStore } from "./store";

describe("agent approval store", () => {
  it("resolves pending approval requests with the submitted decision", async () => {
    const store = createAgentApprovalStore();

    const approval = store.request({
      agentId: "agent-1",
      approvalId: "approval-1",
      tool: {
        input: { file: "src/index.ts" },
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    });

    expect(
      store.decide({
        agentId: "agent-1",
        approvalId: "approval-1",
        approved: false,
        reason: "Not during deployment"
      })
    ).toBe(true);
    await expect(approval).resolves.toEqual({
      approved: false,
      reason: "Not during deployment"
    });
    expect(
      store.getStatus({
        agentId: "agent-1",
        approvalId: "approval-1"
      })
    ).toEqual({
      approved: false,
      reason: "Not during deployment",
      status: "decided"
    });
  });

  it("reports pending approval status before a decision is submitted", () => {
    const store = createAgentApprovalStore();

    void store.request({
      agentId: "agent-1",
      approvalId: "approval-1",
      tool: {
        input: {},
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    });

    expect(
      store.getStatus({
        agentId: "agent-1",
        approvalId: "approval-1"
      })
    ).toEqual({ status: "pending" });
  });

  it("rejects decisions for unknown approvals", () => {
    const store = createAgentApprovalStore();

    expect(
      store.decide({
        agentId: "agent-1",
        approvalId: "missing",
        approved: true
      })
    ).toBe(false);
  });
});
