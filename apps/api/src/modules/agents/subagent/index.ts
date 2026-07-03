import { Type, type Static } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import type { AgentSessionMetadata } from "../agent-types";

export interface SubagentRun<ParentSession> {
  agentId: string;
  agentName: string;
  agentSession: ParentSession;
  consumed: boolean;
  depth: number;
  lastAssistantText: string;
  parentAgentId: string;
  parentAgentName?: string;
  parentSession: ParentSession;
  session: AgentSessionMetadata;
  status: "running" | "completed";
}

const callSubagentParameters = Type.Object({
  agentName: Type.Optional(
    Type.String({
      description: "Short display name for the child agent."
    })
  ),
  prompt: Type.Optional(
    Type.String({
      description: "Task prompt for the child agent."
    })
  ),
  subagents: Type.Optional(
    Type.Array(
      Type.Object({
        agentName: Type.Optional(
          Type.String({
            description: "Short display name for this child agent."
          })
        ),
        prompt: Type.String({
          description: "Task prompt for this child agent."
        })
      }),
      {
        description: "Child agents to start in parallel."
      }
    )
  )
});

type CallSubagentParameters = Static<typeof callSubagentParameters>;

const revokeSubagentParameters = Type.Object({
  agentId: Type.String({
    description: "Existing completed child agent id to continue."
  }),
  prompt: Type.String({
    description: "Follow-up prompt for the child agent."
  })
});

type RevokeSubagentParameters = Static<typeof revokeSubagentParameters>;

interface CallSubagentRequest {
  agentName: string;
  prompt: string;
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
    parameters: callSubagentParameters,
    async execute(toolCallId, rawParams) {
      const requests = parseCallSubagentRequests(
        rawParams as Partial<CallSubagentParameters>
      );
      const results = await Promise.all(
        requests.map(({ agentName, prompt }) =>
          input.startSubagent({ agentName, prompt, toolCallId })
        )
      );

      if (results.length === 1) {
        const result = results[0];
        if (!result) throw new Error("call_subagent failed to start");
        return result;
      }

      return {
        content: [
          {
            text: results
              .flatMap((result) => result.content.map((block) => block.text))
              .join("\n"),
            type: "text" as const
          }
        ],
        details: {
          subagents: results.map((result) => result.details)
        }
      };
    }
  };
}

export function createRevokeSubagentTool(input: {
  continueSubagent: (input: {
    agentId: string;
    prompt: string;
    toolCallId: string;
  }) => Promise<{
    content: { text: string; type: "text" }[];
    details: unknown;
  }>;
}): ServerPlugin.PluginTool {
  return {
    description: "Continue an existing completed child agent with a follow-up prompt.",
    executionMode: "parallel",
    label: "Revoke Subagent",
    name: "revoke_subagent",
    parameters: revokeSubagentParameters,
    async execute(toolCallId, rawParams) {
      const { agentId, prompt } = parseRevokeSubagentRequest(
        rawParams as Partial<RevokeSubagentParameters>
      );

      return input.continueSubagent({ agentId, prompt, toolCallId });
    }
  };
}

function parseCallSubagentRequests(
  params: Partial<CallSubagentParameters>
): CallSubagentRequest[] {
  const rawSubagents = Array.isArray(params.subagents) ? params.subagents : [];
  const requests = rawSubagents.length
    ? rawSubagents.map((subagent) => ({
        agentName: subagent.agentName,
        prompt: subagent.prompt
      }))
    : [{ agentName: params.agentName, prompt: params.prompt }];

  return requests.map((request) => {
    const agentName =
      typeof request.agentName === "string" && request.agentName.trim()
        ? request.agentName.trim()
        : "subagent";
    const prompt =
      typeof request.prompt === "string" && request.prompt.trim()
        ? request.prompt.trim()
        : "";

    if (!prompt) {
      throw new Error("call_subagent requires a prompt");
    }

    return { agentName, prompt };
  });
}

function parseRevokeSubagentRequest(
  params: Partial<RevokeSubagentParameters>
): { agentId: string; prompt: string } {
  const agentId =
    typeof params.agentId === "string" && params.agentId.trim()
      ? params.agentId.trim()
      : "";
  const prompt =
    typeof params.prompt === "string" && params.prompt.trim()
      ? params.prompt.trim()
      : "";

  if (!agentId) {
    throw new Error("revoke_subagent requires an agentId");
  }
  if (!prompt) {
    throw new Error("revoke_subagent requires a prompt");
  }

  return { agentId, prompt };
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
