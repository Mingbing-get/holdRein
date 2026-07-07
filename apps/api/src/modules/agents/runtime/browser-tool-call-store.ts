import type { AgentToolResult } from "@earendil-works/pi-agent-core";

import type { BrowserToolResultInput } from "../agent-types";

export interface BrowserToolCallRequest {
  agentId: string;
  arguments: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
}

export interface BrowserToolCallStore {
  clearAgent: (agentId: string) => void;
  createCall: (request: BrowserToolCallRequest) => Promise<BrowserToolResult>;
  submitResult: (input: BrowserToolResultInput) => boolean;
}

type BrowserToolResult = AgentToolResult<{ toolName?: string }> & {
  isError?: boolean;
};

export function createBrowserToolCallStore(): BrowserToolCallStore {
  const pending = new Map<string, PendingCall>();

  return {
    clearAgent(agentId) {
      for (const [key, call] of pending) {
        if (call.agentId !== agentId) continue;
        pending.delete(key);
        call.resolve({
          content: [
            { text: "Browser tool call was interrupted.", type: "text" }
          ],
          details: { toolName: call.toolName },
          isError: true
        });
      }
    },
    createCall(request) {
      const key = createKey(request.agentId, request.toolCallId);
      if (pending.has(key)) {
        return Promise.resolve({
          content: [
            { text: "Duplicate browser tool call id.", type: "text" }
          ],
          details: { toolName: request.toolName },
          isError: true
        });
      }

      return new Promise<BrowserToolResult>((resolve) => {
        pending.set(key, {
          agentId: request.agentId,
          resolve,
          toolName: request.toolName
        });
      });
    },
    submitResult(input) {
      const key = createKey(input.agentId, input.toolCallId);
      const call = pending.get(key);
      if (!call) return false;
      pending.delete(key);
      call.resolve({
        content:
          typeof input.content === "string"
            ? [{ text: input.content, type: "text" }]
            : input.content,
        details: { toolName: call.toolName },
        isError: input.isError ?? false
      });
      return true;
    }
  };
}

interface PendingCall {
  agentId: string;
  resolve: (result: BrowserToolResult) => void;
  toolName: string;
}

function createKey(agentId: string, toolCallId: string): string {
  return `${agentId}\0${toolCallId}`;
}
