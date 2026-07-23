import { describe, expect, it, vi } from "vitest";

import {
  createMcpPluginTools,
  createMcpReadResourceTool,
  createMcpResourceListTool
} from "./tools";
import type { McpClientManager } from "./mcp-client";
import type { McpServerRuntimeConfig } from "./types";

describe("mcp plugin tools", () => {
  it("contributes enabled MCP tools with normalized names", async () => {
    const manager = createManager({
      listTools: {
        local: {
          tools: [
            {
              description: "Say hi",
              inputSchema: { type: "object" },
              name: "say-hi"
            }
          ]
        }
      }
    });

    const tools = await createMcpPluginTools({
      clientManager: manager,
      servers: [createServer({ id: "local" })]
    });

    expect(tools.map((tool) => tool.name)).toContain("mcp_local_say_hi");
    expect(tools.find((tool) => tool.name === "mcp_local_say_hi")).toMatchObject({
      description: "Say hi",
      parameters: { type: "object" }
    });
  });

  it("does not include disabled servers because callers pass runtime configs only", async () => {
    const tools = await createMcpPluginTools({
      clientManager: createManager({}),
      servers: []
    });

    expect(tools).toEqual([]);
  });

  it("isolates tool listing failures per server", async () => {
    const tools = await createMcpPluginTools({
      clientManager: createManager({
        listTools: {
          broken: new Error("boom"),
          ok: { tools: [{ name: "echo" }] }
        }
      }),
      servers: [createServer({ id: "broken" }), createServer({ id: "ok" })]
    });

    expect(tools.map((tool) => tool.name)).toEqual(["mcp_ok_echo"]);
  });

  it("lists resources and templates for one or all servers", async () => {
    const tool = createMcpResourceListTool({
      clientManager: createManager({
        listResources: {
          local: {
            resourceTemplates: [{ uriTemplate: "file://{id}" }],
            resources: [{ uri: "file://one" }]
          }
        }
      }),
      servers: [createServer({ id: "local" })]
    });

    const result = await tool.execute("tool-1", {});
    const text = result.content[0]?.type === "text" ? result.content[0].text : "";

    expect(JSON.parse(text)).toEqual({
      servers: [
        {
          id: "local",
          name: "Local",
          resourceTemplates: [{ uriTemplate: "file://{id}" }],
          resources: [{ uri: "file://one" }]
        }
      ]
    });
  });

  it("reads resource content from a selected server", async () => {
    const tool = createMcpReadResourceTool({
      clientManager: createManager({
        readResource: {
          local: { contents: [{ text: "hello", type: "text" }] }
        }
      }),
      servers: [createServer({ id: "local" })]
    });

    const result = await tool.execute("tool-1", {
      serverId: "local",
      uri: "file://one"
    });

    expect(result.content).toEqual([{ text: "hello", type: "text" }]);
  });
});

function createManager(results: {
  readonly listResources?: Record<string, unknown>;
  readonly listTools?: Record<string, unknown>;
  readonly readResource?: Record<string, unknown>;
}): McpClientManager {
  return {
    callTool: vi.fn(),
    listResources: vi.fn(async (server: McpServerRuntimeConfig) => {
      const result = results.listResources?.[server.id];
      if (result instanceof Error) {
        throw result;
      }
      return result ?? { resourceTemplates: [], resources: [] };
    }),
    listTools: vi.fn(async (server: McpServerRuntimeConfig) => {
      const result = results.listTools?.[server.id];
      if (result instanceof Error) {
        throw result;
      }
      return result ?? { tools: [] };
    }),
    readResource: vi.fn(async (server: McpServerRuntimeConfig) => {
      const result = results.readResource?.[server.id];
      if (result instanceof Error) {
        throw result;
      }
      return result ?? { contents: [] };
    })
  } as unknown as McpClientManager;
}

function createServer(
  overrides: Partial<McpServerRuntimeConfig> = {}
): McpServerRuntimeConfig {
  return {
    args: [],
    command: "node",
    enabled: true,
    env: {},
    headers: {},
    id: "local",
    name: "Local",
    transport: "stdio",
    ...overrides
  };
}
