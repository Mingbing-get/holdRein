import type { ToolCallResult } from "@earendil-works/pi-agent-core";

import type { BrowserToolResultInput } from "../agent-types";

export interface BrowserToolCallRequest {
  agentId: string;
  arguments: Record<string, unknown>;
  toolCallId: string;
  toolName: string;
}

export interface BrowserToolCallStore {
  clearAgent: (agentId: string) => void;
  createCall: (request: BrowserToolCallRequest) => Promise<ToolCallResult>;
  submitResult: (input: BrowserToolResultInput) => boolean;
}

export function createBrowserToolCallStore(
  timeoutMs = 60_000
): BrowserToolCallStore {
  const pending = new Map<string, PendingCall>();

  return {
    clearAgent(agentId) {
      for (const [key, call] of pending) {
        if (call.agentId !== agentId) continue;
        clearTimeout(call.timeout);
        pending.delete(key);
        call.resolve({
          content: [
            { text: "Browser tool call was interrupted.", type: "text" }
          ],
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
          isError: true
        });
      }

      return new Promise<ToolCallResult>((resolve) => {
        const timeout = setTimeout(() => {
          pending.delete(key);
          resolve({
            content: [
              { text: "Browser tool call timed out.", type: "text" }
            ],
            isError: true
          });
        }, timeoutMs);
        pending.set(key, { agentId: request.agentId, resolve, timeout });
      });
    },
    submitResult(input) {
      const key = createKey(input.agentId, input.toolCallId);
      const call = pending.get(key);
      if (!call) return false;
      clearTimeout(call.timeout);
      pending.delete(key);
      call.resolve({
        content:
          typeof input.content === "string"
            ? [{ text: input.content, type: "text" }]
            : input.content,
        isError: input.isError ?? false
      });
      return true;
    }
  };
}

interface PendingCall {
  agentId: string;
  resolve: (result: ToolCallResult) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function createKey(agentId: string, toolCallId: string): string {
  return `${agentId}\0${toolCallId}`;
}
