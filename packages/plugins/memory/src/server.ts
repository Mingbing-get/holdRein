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

        console.log(JSON.stringify(messages))

        if (!hasNonEmptyUserMessage(messages)) {
          return undefined;
        }

        return {
          agentName: MEMORY_ORGANIZER_AGENT_NAME,
          prompt: createMemoryOrganizerPrompt(messages),
          useSubagent: true
        };
      },
      systemPrompts
    };
  }
};

export default serverPlugin;

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
