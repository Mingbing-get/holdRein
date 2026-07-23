import { Type } from "@earendil-works/pi-ai";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { McpClientManager } from "./mcp-client";
import type { McpServerRuntimeConfig } from "./types";

const emptyObjectParameters = Type.Object({});

type NormalizedMcpContent =
  | { readonly text: string; readonly type: "text" }
  | { readonly data: string; readonly mimeType: string; readonly type: "image" };

export interface CreateMcpToolsOptions {
  readonly clientManager?: McpClientManager;
  readonly servers: readonly McpServerRuntimeConfig[];
}

export async function createMcpPluginTools(
  options: CreateMcpToolsOptions
): Promise<ServerPlugin.PluginTool[]> {
  const clientManager = options.clientManager ?? new McpClientManager();
  const tools: ServerPlugin.PluginTool[] = [];

  for (const server of options.servers) {
    try {
      for (const tool of readMcpTools(await clientManager.listTools(server))) {
        tools.push(createWrappedMcpTool(clientManager, server, tool));
      }
    } catch {
      // A broken MCP server should not suppress other configured servers.
    }
  }

  return tools;
}

export function createMcpResourceListTool(
  options: CreateMcpToolsOptions
): ServerPlugin.PluginTool {
  const clientManager = options.clientManager ?? new McpClientManager();

  return {
    description: "List MCP resources and resource templates from configured servers.",
    executionMode: "parallel",
    label: "MCP List Resources",
    name: "mcp_list_resources",
    parameters: Type.Object({
      serverId: Type.Optional(Type.String({ description: "MCP server id." }))
    }),
    async execute(_toolCallId, rawParams) {
      const params = rawParams as { serverId?: string };
      const servers = params.serverId
        ? options.servers.filter((server) => server.id === params.serverId)
        : options.servers;
      const results = [];

      for (const server of servers) {
        try {
          const listed = await clientManager.listResources(server);
          results.push({
            id: server.id,
            name: server.name,
            resourceTemplates: listed.resourceTemplates,
            resources: listed.resources
          });
        } catch (error) {
          results.push({
            error: error instanceof Error ? error.message : "Failed to list resources",
            id: server.id,
            name: server.name,
            resourceTemplates: [],
            resources: []
          });
        }
      }

      return textResult(JSON.stringify({ servers: results }, null, 2));
    }
  };
}

export function createMcpReadResourceTool(
  options: CreateMcpToolsOptions
): ServerPlugin.PluginTool {
  const clientManager = options.clientManager ?? new McpClientManager();

  return {
    description: "Read an MCP resource by server id and URI.",
    executionMode: "parallel",
    label: "MCP Read Resource",
    name: "mcp_read_resource",
    parameters: Type.Object({
      serverId: Type.String({ description: "MCP server id." }),
      uri: Type.String({ description: "Resource URI." })
    }),
    async execute(_toolCallId, rawParams) {
      const params = rawParams as { serverId?: string; uri?: string };
      if (!params.serverId || !params.uri) {
        throw new Error("serverId and uri are required");
      }

      const server = options.servers.find((candidate) => candidate.id === params.serverId);
      if (!server) {
        throw new Error(`Unknown MCP server: ${params.serverId}`);
      }

      return {
        content: normalizeMcpContent(await clientManager.readResource(server, params.uri)),
        details: { serverId: server.id, uri: params.uri }
      };
    }
  };
}

function createWrappedMcpTool(
  clientManager: McpClientManager,
  server: McpServerRuntimeConfig,
  tool: McpToolDescription
): ServerPlugin.PluginTool {
  return {
    description: tool.description ?? `Call MCP tool ${tool.name}.`,
    executionMode: "parallel",
    label: `${server.name}: ${tool.name}`,
    name: normalizeToolName(`mcp_${server.id}_${tool.name}`),
    parameters: tool.inputSchema ?? emptyObjectParameters,
    async execute(_toolCallId, rawParams) {
      const params = isRecord(rawParams) ? rawParams : {};
      return {
        content: normalizeMcpContent(
          await clientManager.callTool(server, tool.name, params)
        ),
        details: { serverId: server.id, toolName: tool.name }
      };
    }
  };
}

interface McpToolDescription {
  readonly description?: string;
  readonly inputSchema?: unknown;
  readonly name: string;
}

function readMcpTools(value: unknown): McpToolDescription[] {
  if (!isRecord(value) || !Array.isArray(value.tools)) {
    return [];
  }

  return value.tools.flatMap((tool) => {
    if (!isRecord(tool) || typeof tool.name !== "string") {
      return [];
    }

    return [
      withoutUndefined({
        description:
          typeof tool.description === "string" ? tool.description : undefined,
        inputSchema: tool.inputSchema,
        name: tool.name
      }) as McpToolDescription
    ];
  });
}

function normalizeMcpContent(result: unknown): NormalizedMcpContent[] {
  if (isRecord(result)) {
    const content = result.content ?? result.contents;
    if (Array.isArray(content)) {
      return content.map(normalizeContentEntry);
    }
  }

  return [{ text: JSON.stringify(result, null, 2), type: "text" }];
}

function normalizeContentEntry(entry: unknown): NormalizedMcpContent {
  if (!isRecord(entry)) {
    return { text: JSON.stringify(entry), type: "text" };
  }

  if (entry.type === "text" && typeof entry.text === "string") {
    return { text: entry.text, type: "text" };
  }

  if (
    entry.type === "image" &&
    typeof entry.data === "string" &&
    typeof entry.mimeType === "string"
  ) {
    return { data: entry.data, mimeType: entry.mimeType, type: "image" };
  }

  return { text: JSON.stringify(entry, null, 2), type: "text" };
}

function textResult(text: string) {
  return {
    content: [
      {
        text,
        type: "text" as const
      }
    ],
    details: {}
  };
}

function normalizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined)
  ) as Partial<T>;
}
