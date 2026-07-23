import { randomUUID } from "node:crypto";

import type { ServerPlugin } from "@hold-rein/plugin-server";
import { describe, expect, it, vi } from "vitest";

import createRouter from "./routes";
import { McpServerConfigService } from "./service";
import { createMcpConfigStorage } from "./storage";

describe("mcp config routes", () => {
  it("lists server summaries", async () => {
    const harness = createHarness();
    const { service } = harness;
    service.saveServerConfig("local", {
      command: "node",
      env: { TOKEN: "secret" },
      name: "Local",
      transport: "stdio"
    });

    const result = harness.call("get", "/servers", {});

    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(harness.sendSuccess).toHaveBeenLastCalledWith(harness.response, [
      expect.objectContaining({
        env: { TOKEN: "********" },
        id: "local",
        name: "Local"
      })
    ]);
    expect(JSON.stringify(harness.sendSuccess.mock.calls)).not.toContain("secret");
  });

  it("saves server config with PUT /servers/:id", async () => {
    const harness = createHarness();

    await harness.call("put", "/servers/:id", {
      body: {
        command: "node",
        env: { TOKEN: "secret" },
        name: "Local",
        transport: "stdio"
      },
      params: { id: "local" }
    });

    expect(harness.sendSuccess).toHaveBeenLastCalledWith(
      harness.response,
      expect.objectContaining({
        env: { TOKEN: "********" },
        id: "local",
        name: "Local"
      })
    );
    expect(JSON.stringify(harness.sendSuccess.mock.calls)).not.toContain("secret");
  });

  it("saves an SSE server config", async () => {
    const harness = createHarness();

    await harness.call("put", "/servers/:id", {
      body: {
        headers: { Authorization: "Bearer token" },
        name: "Legacy SSE",
        transport: "sse",
        url: "https://mcp.example.com/sse"
      },
      params: { id: "legacy-sse" }
    });

    expect(harness.sendSuccess).toHaveBeenLastCalledWith(
      harness.response,
      expect.objectContaining({
        id: "legacy-sse",
        transport: "sse",
        url: "https://mcp.example.com/sse"
      })
    );
  });

  it("deletes server config with DELETE /servers/:id", async () => {
    const harness = createHarness();
    const { service } = harness;
    service.saveServerConfig("local", {
      command: "node",
      name: "Local",
      transport: "stdio"
    });

    await harness.call("delete", "/servers/:id", {
      params: { id: "local" }
    });

    expect(harness.sendSuccess).toHaveBeenLastCalledWith(harness.response, {
      deleted: true
    });
    expect(service.listServerConfigs()).toEqual([]);
  });

  it("rejects invalid request bodies", async () => {
    const harness = createHarness();

    await harness.call("put", "/servers/:id", {
      body: { command: "node", name: "Local", transport: "stdio", extra: true },
      params: { id: "local" }
    });

    expect(harness.sendError).toHaveBeenCalledWith(
      harness.response,
      harness.definitions.badRequest,
      expect.stringContaining("Unexpected field")
    );
  });
});

function createHarness() {
  const definitions = createDefinitions();
  const sendSuccess = vi.fn();
  const sendError = vi.fn();
  const storage = createMcpConfigStorage({
    configPath: `/tmp/hold-rein-mcp-routes-${randomUUID()}.json`
  });
  const service = new McpServerConfigService({
    storage,
    userEnvDir: `/tmp/hold-rein-mcp-routes-env-${randomUUID()}`
  });
  const router = createRouter(
    {
      RESPONSE_CODE_DEFINITIONS: definitions,
      sendError,
      sendSuccess
    },
    { service }
  );
  const response = {};

  return {
    definitions,
    response,
    sendError,
    sendSuccess,
    service,
    call(method: string, path: string, request: object) {
      return findRouteHandler(router, method, path)(request, response);
    }
  };
}

function createDefinitions(): ServerPlugin.RouteContext["RESPONSE_CODE_DEFINITIONS"] {
  const definition = (httpStatus: number) => ({
    code: httpStatus,
    defaultMessage: "",
    description: "",
    httpStatus
  });
  return {
    success: definition(200),
    badRequest: definition(400),
    unauthorized: definition(401),
    forbidden: definition(403),
    notFound: definition(404),
    conflict: definition(409),
    internalError: definition(500)
  };
}

function findRouteHandler(
  router: unknown,
  method: string,
  path: string
): (request: object, response: object) => Promise<void> {
  const layer = (router as {
    stack: {
      route?: {
        methods: Record<string, boolean>;
        path: string;
        stack: {
          handle: (request: object, response: object) => Promise<void>;
        }[];
      };
    }[];
  }).stack.find((item) => item.route?.path === path && item.route.methods[method]);

  if (!layer?.route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  return layer.route.stack[0].handle;
}
