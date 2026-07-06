import type { ServerPlugin } from "@hold-rein/plugin-server";

import { PLUGIN_ID } from "./plugin-id";
import { createMemorySystemPrompt } from "./server/memory-context";
import { createMemoryOrganizerPrompt } from "./server/organizer-prompt";

const MEMORY_ORGANIZER_AGENT_NAME = "memory-organizer";

const serverPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: async (context) => {
    if (context.agentName === MEMORY_ORGANIZER_AGENT_NAME) {
      return { systemPrompts: [] };
    }

    const systemPrompts = [await createMemorySystemPrompt(context.env.cwd)];

    if (context.agentName !== "main") {
      return { systemPrompts };
    }

    return {
      agentEndPriority: -9999,
      onAgentEnd(input) {
        const messages = scopeMessagesAfterLatestCustomMessageFromAgent(
          input.messages,
          MEMORY_ORGANIZER_AGENT_NAME
        );

        if (!hasNonEmptyUserMessage(messages)) {
          return undefined;
        }

        return {
          agentName: MEMORY_ORGANIZER_AGENT_NAME,
          prompt: createMemoryOrganizerPrompt(simplifyMessagesForMemory(messages)),
          useSubagent: true
        };
      },
      systemPrompts
    };
  }
};

export default serverPlugin;

function simplifyMessagesForMemory(
  messages: readonly unknown[]
): readonly unknown[] {
  return messages.flatMap((message) => {
    const simplified = simplifyMessageForMemory(message);
    return simplified === undefined ? [] : [simplified];
  });
}

function simplifyMessageForMemory(
  message: unknown
): Record<string, unknown> | undefined {
  if (!isRecord(message)) {
    return undefined;
  }

  if (message.role === "user") {
    return { content: message.content, role: "user" };
  }

  if (message.role === "assistant") {
    return {
      content: message.content,
      role: "assistant",
      stopReason: message.stopReason
    };
  }

  if (message.role === "toolResult") {
    return {
      content: message.content,
      isError: message.isError,
      role: "toolResult",
      toolCallId: message.toolCallId,
      toolName: message.toolName
    };
  }

  if (message.role === "custom") {
    return {
      content: message.content,
      customType: message.customType,
      role: "custom"
    };
  }

  if (message.role === "bashExecution") {
    return {
      command: message.command,
      ...(message.exitCode === undefined ? {} : { exitCode: message.exitCode }),
      output: message.output,
      role: "bashExecution",
      truncated: message.truncated
    };
  }

  if (message.role === "branchSummary") {
    return { role: "branchSummary", summary: message.summary };
  }

  if (message.role === "compactionSummary") {
    return { role: "compactionSummary", summary: message.summary };
  }

  return undefined;
}

function scopeMessagesAfterLatestCustomMessageFromAgent(
  messages: readonly unknown[],
  agentName: string
): readonly unknown[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (getCustomMessageAgentName(messages[index]) === agentName) {
      return messages.slice(index + 1);
    }
  }

  return messages;
}

function hasNonEmptyUserMessage(messages: readonly unknown[]): boolean {
  return messages.some((message) => {
    if (!isRecord(message) || message.role !== "user") {
      return false;
    }

    return hasNonEmptyContent(message.content);
  });
}

function hasNonEmptyContent(content: unknown): boolean {
  if (typeof content === "string") {
    return content.trim().length > 0;
  }

  if (!Array.isArray(content)) {
    return false;
  }

  return content.some((entry) => {
    if (!isRecord(entry)) {
      return false;
    }

    if (typeof entry.text === "string") {
      return entry.text.trim().length > 0;
    }

    return Object.keys(entry).length > 0;
  });
}

function getCustomMessageAgentName(message: unknown): string | undefined {
  if (!isRecord(message) || message.role !== "custom" || !isRecord(message.details)) {
    return undefined;
  }

  return typeof message.details.agentName === "string"
    ? message.details.agentName
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
