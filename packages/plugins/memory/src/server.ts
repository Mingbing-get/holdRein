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
        return {
          agentName: MEMORY_ORGANIZER_AGENT_NAME,
          prompt: createMemoryOrganizerPrompt(input.messages),
          useSubagent: true
        };
      },
      systemPrompts
    };
  }
};

export default serverPlugin;
