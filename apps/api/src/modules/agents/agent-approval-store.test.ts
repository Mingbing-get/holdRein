import { describe, expect, it } from "vitest";

import { createAgentApprovalStore } from "./agent-approval-store";

describe("agent approval store", () => {
  it("resolves pending approval requests with the submitted decision", async () => {
    const store = createAgentApprovalStore();

    const approval = store.request({
      agentId: "agent-1",
      approvalId: "approval-1",
      command: "rm -rf dist",
      cwd: "/tmp/project",
      risk: "dangerous"
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
