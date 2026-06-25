import type { ServerPlugin } from "@hold-rein/plugin-server";

import type { BrowserRuntimeToolSchema } from "../agent-types";
import type { AgentEventBus } from "../event/event-bus";
import type { BrowserToolCallStore } from "./browser-tool-call-store";

interface CreateBrowserRuntimeToolsInput {
  agentId: string;
  eventBus: AgentEventBus;
  store: BrowserToolCallStore;
  tools: readonly BrowserRuntimeToolSchema[] | undefined;
}

export function createBrowserRuntimeTools(
  input: CreateBrowserRuntimeToolsInput
): ServerPlugin.PluginTool[] {
  return (input.tools ?? []).map((tool) => ({
    description: tool.description ?? tool.name,
    execute: (toolCallId: string, toolInput: unknown) => {
      const args = toArgumentsRecord(toolInput);
      input.eventBus.emit({
        agentId: input.agentId,
        payload: {
          arguments: args,
          toolCallId,
          toolName: tool.name
        },
        type: "browser_tool_call_requested"
      });
      return input.store.createCall({
        agentId: input.agentId,
        arguments: args,
        toolCallId,
        toolName: tool.name
      });
    },
    label: tool.name,
    name: tool.name,
    parameters: tool.inputSchema as never
  }));
}

function toArgumentsRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
