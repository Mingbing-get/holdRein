import { describe, expect, it, vi } from "vitest";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { McpClientManager, type McpClientLike } from "./mcp-client";
import type { McpServerRuntimeConfig } from "./types";

describe("mcp client manager", () => {
  it("lists tools and closes the client", async () => {
    const client = createClient({ listTools: { tools: [{ name: "echo" }] } });
    const manager = createManager(client);

    await expect(manager.listTools(createRuntimeConfig())).resolves.toEqual({
      tools: [{ name: "echo" }]
    });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("calls tools and closes the client", async () => {
    const client = createClient({
      callTool: { content: [{ text: "ok", type: "text" }] }
    });
    const manager = createManager(client);

    await expect(
      manager.callTool(createRuntimeConfig(), "echo", { message: "hi" })
    ).resolves.toEqual({ content: [{ text: "ok", type: "text" }] });
    expect(client.callTool).toHaveBeenCalledWith({
      arguments: { message: "hi" },
      name: "echo"
    });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("lists resources and resource templates", async () => {
    const client = createClient({
      listResourceTemplates: { resourceTemplates: [{ uriTemplate: "file://{id}" }] },
      listResources: { resources: [{ uri: "file://one" }] }
    });
    const manager = createManager(client);

    await expect(manager.listResources(createRuntimeConfig())).resolves.toEqual({
      resourceTemplates: [{ uriTemplate: "file://{id}" }],
      resources: [{ uri: "file://one" }]
    });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("reads resources and closes the client", async () => {
    const client = createClient({
      readResource: { contents: [{ text: "hello", type: "text" }] }
    });
    const manager = createManager(client);

    await expect(
      manager.readResource(createRuntimeConfig(), "file://one")
    ).resolves.toEqual({ contents: [{ text: "hello", type: "text" }] });
    expect(client.readResource).toHaveBeenCalledWith({ uri: "file://one" });
    expect(client.close).toHaveBeenCalledOnce();
  });

  it("creates an SSE client transport for SSE configs", async () => {
    const module = (await import("./mcp-client")) as typeof import("./mcp-client") & {
      readonly createTransport?: (
        config: McpServerRuntimeConfig
      ) => Promise<Transport>;
    };

    expect(module.createTransport).toBeTypeOf("function");
    const transport = await module.createTransport?.({
      ...createRuntimeConfig(),
      headers: { Authorization: "Bearer token" },
      transport: "sse",
      url: "https://mcp.example.com/sse"
    });

    expect(transport).toBeInstanceOf(SSEClientTransport);
  });
});

function createManager(client: McpClientLike): McpClientManager {
  return new McpClientManager({
    createClient: vi.fn(async () => client)
  });
}

function createClient(results: {
  readonly callTool?: unknown;
  readonly listResourceTemplates?: unknown;
  readonly listResources?: unknown;
  readonly listTools?: unknown;
  readonly readResource?: unknown;
}): McpClientLike {
  return {
    callTool: vi.fn(async () => results.callTool),
    close: vi.fn(async () => undefined),
    listResourceTemplates: vi.fn(async () => results.listResourceTemplates),
    listResources: vi.fn(async () => results.listResources),
    listTools: vi.fn(async () => results.listTools),
    readResource: vi.fn(async () => results.readResource)
  };
}

function createRuntimeConfig(): McpServerRuntimeConfig {
  return {
    args: ["server.js"],
    command: "node",
    enabled: true,
    env: { TOKEN: "secret" },
    headers: {},
    id: "local",
    name: "Local",
    transport: "stdio"
  };
}
