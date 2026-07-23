import type { McpServerRuntimeConfig } from "./types";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export interface McpClientLike {
  readonly callTool: (request: {
    readonly arguments?: Record<string, unknown>;
    readonly name: string;
  }) => Promise<unknown>;
  readonly close: () => Promise<void> | void;
  readonly listResourceTemplates: () => Promise<unknown>;
  readonly listResources: () => Promise<unknown>;
  readonly listTools: () => Promise<unknown>;
  readonly readResource: (request: { readonly uri: string }) => Promise<unknown>;
}

export interface McpClientManagerOptions {
  readonly createClient?: (
    config: McpServerRuntimeConfig
  ) => Promise<McpClientLike>;
}

export class McpClientManager {
  readonly #createClient: (config: McpServerRuntimeConfig) => Promise<McpClientLike>;

  constructor(options: McpClientManagerOptions = {}) {
    this.#createClient = options.createClient ?? createSdkMcpClient;
  }

  listTools(config: McpServerRuntimeConfig): Promise<unknown> {
    return this.#withClient(config, (client) => client.listTools());
  }

  callTool(
    config: McpServerRuntimeConfig,
    name: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return this.#withClient(config, (client) =>
      client.callTool({ arguments: args, name })
    );
  }

  async listResources(config: McpServerRuntimeConfig): Promise<{
    readonly resourceTemplates: readonly unknown[];
    readonly resources: readonly unknown[];
  }> {
    return this.#withClient(config, async (client) => ({
      resourceTemplates: readArrayProperty(
        await client.listResourceTemplates(),
        "resourceTemplates"
      ),
      resources: readArrayProperty(await client.listResources(), "resources")
    }));
  }

  readResource(config: McpServerRuntimeConfig, uri: string): Promise<unknown> {
    return this.#withClient(config, (client) => client.readResource({ uri }));
  }

  async #withClient<T>(
    config: McpServerRuntimeConfig,
    operation: (client: McpClientLike) => Promise<T>
  ): Promise<T> {
    const client = await this.#createClient(config);

    try {
      return await operation(client);
    } finally {
      await client.close();
    }
  }
}

function readArrayProperty(value: unknown, property: string): readonly unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const propertyValue = value[property];
  return Array.isArray(propertyValue) ? propertyValue : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function createSdkMcpClient(
  config: McpServerRuntimeConfig
): Promise<McpClientLike> {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const client = new Client({
    name: "hold-rein-mcp-plugin",
    version: "0.0.0"
  });

  await client.connect(await createTransport(config));
  return client as McpClientLike;
}

export async function createTransport(
  config: McpServerRuntimeConfig
): Promise<Transport> {
  if (config.transport === "stdio") {
    const { StdioClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );

    return new StdioClientTransport({
      args: [...config.args],
      command: config.command ?? "",
      env: { ...readProcessEnv(), ...config.env }
    });
  }

  if (config.transport === "sse") {
    const { SSEClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/sse.js"
    );

    return new SSEClientTransport(new URL(config.url ?? ""), {
      requestInit: { headers: { ...config.headers } }
    }) as unknown as Transport;
  }

  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );

  return new StreamableHTTPClientTransport(new URL(config.url ?? ""), {
    requestInit: {
      headers: { ...config.headers }
    }
  }) as unknown as Transport;
}

function readProcessEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value]]
    )
  );
}
