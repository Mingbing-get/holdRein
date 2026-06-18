import { randomUUID } from "node:crypto";

import type { ServerPlugin } from "@hold-rein/plugin-server";

import type { AgentApprovalStore } from "./agent-approval-store";
import type { AgentEventBus } from "./agent-event-bus";
import type { ToolApprovalRequest } from "./agent-types";

export async function runToolBeforeExecute(input: {
  agentId: string;
  approvalStore: AgentApprovalStore;
  event: ServerPlugin.ToolBeforeExecuteOptions["event"];
  eventBus: AgentEventBus;
  tool: ServerPlugin.PluginTool;
  workspacePath: string;
}) {
  if (!input.tool.beforeExecute) return undefined;

  return input.tool.beforeExecute({
    workspacePath: input.workspacePath,
    event: input.event,
    requestApproval: async (title) => {
      const approvalId = `approval_${randomUUID()}`;
      const approvalRequest: ToolApprovalRequest = {
        agentId: input.agentId,
        approvalId,
        ...(title === undefined ? {} : { title }),
        tool: {
          name: input.tool.name,
          input: input.event.input,
          ...(input.tool.description === undefined
            ? {}
            : { description: input.tool.description }),
          ...(input.tool.label === undefined ? {} : { label: input.tool.label }),
          toolCallId: input.event.toolCallId
        }
      };
      const approval = input.approvalStore.request(approvalRequest);
      input.eventBus.emit({
        agentId: input.agentId,
        payload: approvalRequest,
        type: "approval_requested"
      });
      const decision = await approval;

      return decision.approved
        ? undefined
        : {
            block: true,
            reason:
              decision.reason?.trim() ||
              `User denied execute tool: ${input.tool.name}`
          };
    }
  });
}
