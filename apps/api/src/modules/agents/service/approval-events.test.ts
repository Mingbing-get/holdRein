import { describe, expect, it, vi } from "vitest";

import { createInMemoryWorkspaceRepository } from "../../workspaces";
import { createAgentApprovalStore } from "../approval/store";
import { createAgentEventBus } from "../event/event-bus";
import { createAgentsService } from ".";

describe("agents service approval events", () => {
  it("adds the current approval status to replayed approval events", async () => {
    const approvalStore = createAgentApprovalStore();
    const eventBus = createAgentEventBus();
    const service = createAgentsService({
      approvalStore,
      eventBus,
      repository: createInMemoryWorkspaceRepository(),
      runtime: {
        interrupt: vi.fn(),
        listMessages: vi.fn(),
        start: vi.fn()
      },
      titleGenerator: { generateTitle: vi.fn() }
    });
    const approval = approvalStore.request({
      agentId: "agent-1",
      approvalId: "approval-1",
      tool: {
        input: {},
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    });
    eventBus.emit({
      agentId: "agent-1",
      payload: {
        agentId: "agent-1",
        approvalId: "approval-1",
        tool: {
          input: {},
          name: "workspace_patch",
          toolCallId: "tool-call-1"
        }
      },
      type: "approval_requested"
    });

    await service.approveAgentAction({
      agentId: "agent-1",
      approvalId: "approval-1",
      approved: true
    });
    await expect(approval).resolves.toEqual({ approved: true });

    const listener = vi.fn();
    service.subscribeToAgentEvents({ agentId: "agent-1" }, listener);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          approvalId: "approval-1",
          approved: true,
          status: "decided"
        }),
        type: "approval_requested"
      })
    );
  });
});
