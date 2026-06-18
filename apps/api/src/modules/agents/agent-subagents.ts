import { Type } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import type { AgentSessionMetadata } from "./agent-types";

export interface SubagentRun<ParentSession> {
  agentId: string;
  agentName: string;
  agentSession: ParentSession;
  consumed: boolean;
  lastAssistantText: string;
  parentAgentId: string;
  parentAgentName?: string;
  parentSession: ParentSession;
  session: AgentSessionMetadata;
  status: "running" | "completed";
}

export function createCallSubagentTool(input: {
  startSubagent: (input: {
    agentName: string;
    prompt: string;
    toolCallId: string;
  }) => Promise<{
    content: { text: string; type: "text" }[];
    details: unknown;
  }>;
}): ServerPlugin.PluginTool {
  return {
    description: "Start a child agent to work on a delegated task.",
    executionMode: "parallel",
    label: "Call Subagent",
    name: "call_subagent",
    parameters: Type.Object({
      agentName: Type.String({
        description: "Short display name for the child agent."
      }),
      prompt: Type.String({
        description: "Task prompt for the child agent."
      })
    }),
    async execute(toolCallId, rawParams) {
      const params = rawParams as Partial<{
        agentName: unknown;
        prompt: unknown;
      }>;
      const agentName =
        typeof params.agentName === "string" && params.agentName.trim()
          ? params.agentName.trim()
          : "subagent";
      const prompt =
        typeof params.prompt === "string" && params.prompt.trim()
          ? params.prompt.trim()
          : "";

      if (!prompt) {
        throw new Error("call_subagent requires a prompt");
      }

      return input.startSubagent({ agentName, prompt, toolCallId });
    }
  };
}

export function getNextCompletedSubagent<ParentSession>(
  subagents: Map<string, SubagentRun<ParentSession>>,
  parentAgentId: string
): SubagentRun<ParentSession> | undefined {
  return Array.from(subagents.values()).find(
    (subagent) =>
      subagent.parentAgentId === parentAgentId &&
      subagent.status === "completed" &&
      !subagent.consumed
  );
}

export function hasRunningSubagent<ParentSession>(
  subagents: Map<string, SubagentRun<ParentSession>>,
  parentAgentId: string
): boolean {
  return Array.from(subagents.values()).some(
    (subagent) =>
      subagent.parentAgentId === parentAgentId && subagent.status === "running"
  );
}

export function formatSubagentResult<ParentSession>(
  subagent: SubagentRun<ParentSession>
): string {
  return [
    `Subagent "${subagent.agentName}" completed.`,
    `agentId: ${subagent.agentId}`,
    "",
    subagent.lastAssistantText || "No assistant response was captured."
  ].join("\n");
}

export function extractAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const record = message as { content?: unknown; role?: unknown };

  if (record.role !== "assistant" || !Array.isArray(record.content)) {
    return "";
  }

  return record.content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const content = block as { text?: unknown; type?: unknown };

      return content.type === "text" && typeof content.text === "string"
        ? content.text
        : "";
    })
    .filter(Boolean)
    .join("\n");
}
