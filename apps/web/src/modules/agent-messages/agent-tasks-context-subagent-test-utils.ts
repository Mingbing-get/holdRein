import { vi } from "vitest";

import type { AgentMessageFetcher } from "./agent-message-api";
import {
  jsonResponse,
  startResult,
  streamResponse
} from "./agent-tasks-context-test-utils";

export function createSubagentApprovalFetcher(): AgentMessageFetcher &
  ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
    }
    if (url.endsWith("/title")) {
      return jsonResponse({ id: "task-1", title: "Project inspection" });
    }
    if (url.endsWith("/approvals/approval-child")) {
      return jsonResponse({
        agentId: "agent-child",
        approvalId: "approval-child",
        approved: true
      });
    }
    return streamResponse((controller) => {
      if (url.includes("agent-1/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              agentId: "agent-1",
              payload: {
                message: {
                  content: "Subagent is running",
                  customType: "callsubagent",
                  details: { agentId: "agent-child" },
                  display: true,
                  id: "message-subagent",
                  role: "custom",
                  timestamp: 1
                }
              },
              sequence: 1,
              timestamp: "now",
              type: "message_start"
            })}\n`
          )
        );
      }
      if (url.includes("agent-child/events")) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              agentId: "agent-child",
              payload: {
                agentId: "agent-child",
                approvalId: "approval-child",
                tool: {
                  input: {},
                  name: "workspace_patch",
                  toolCallId: "tool-call-child"
                }
              },
              sequence: 1,
              timestamp: "now",
              type: "approval_requested"
            })}\n`
          )
        );
      }
    });
  }) as AgentMessageFetcher & ReturnType<typeof vi.fn>;
}
