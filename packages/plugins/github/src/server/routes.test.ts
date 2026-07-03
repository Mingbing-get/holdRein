import { describe, expect, it, vi } from "vitest";
import type { ServerPlugin } from "@hold-rein/plugin-server";

import { GitConflictError, type GitService } from "./git-service";
import createRouter from "./routes";

describe("Git plugin routes", () => {
  it("returns repository status for the requested workspace", async () => {
    const service = createService();
    const harness = createHarness(() => service);

    await harness.call("get", "/status", {
      query: { workspacePath: "/workspace" }
    });

    expect(harness.sendSuccess).toHaveBeenCalledWith(
      harness.response,
      { initialized: false }
    );
  });

  it("initializes the requested workspace", async () => {
    const service = createService();
    const factory = vi.fn(() => service);
    const harness = createHarness(factory);

    await harness.call("post", "/initialize", {
      body: { workspacePath: "/workspace" }
    });

    expect(factory).toHaveBeenCalledWith("/workspace");
    expect(service.initialize).toHaveBeenCalledOnce();
  });

  it("switches to a named local branch", async () => {
    const service = createService();
    const harness = createHarness(() => service);

    await harness.call("post", "/branches/switch", {
      body: { workspacePath: "/workspace", branch: "feature/demo" }
    });

    expect(service.switchBranch).toHaveBeenCalledWith("feature/demo");
  });

  it("commits and optionally pushes with the supplied message", async () => {
    const service = createService();
    const harness = createHarness(() => service);

    await harness.call("post", "/commits", {
      body: { workspacePath: "/workspace", message: "ship it", push: true }
    });

    expect(service.commit).toHaveBeenCalledWith("ship it", true);
  });

  it("rejects malformed requests and maps dirty worktrees to conflict", async () => {
    const service = createService();
    const harness = createHarness(() => service);

    await harness.call("post", "/commits", {
      body: { workspacePath: "relative", message: "", push: "yes" }
    });
    expect(harness.sendError).toHaveBeenLastCalledWith(
      harness.response,
      harness.definitions.badRequest,
      expect.any(String)
    );

    vi.mocked(service.switchBranch).mockRejectedValue(
      new GitConflictError("dirty")
    );
    await harness.call("post", "/branches/switch", {
      body: { workspacePath: "/workspace", branch: "other" }
    });
    expect(harness.sendError).toHaveBeenLastCalledWith(
      harness.response,
      harness.definitions.conflict,
      "dirty"
    );
  });
});

function createHarness(factory: (workspacePath: string) => GitService) {
  const definitions = createDefinitions();
  const sendSuccess = vi.fn();
  const sendError = vi.fn();
  const router = createRouter({
    RESPONSE_CODE_DEFINITIONS: definitions,
    sendSuccess,
    sendError
  }, { createGitService: factory });
  const response = {};

  return {
    definitions,
    response,
    sendError,
    sendSuccess,
    async call(method: string, path: string, request: object) {
      await findRouteHandler(router, method, path)(request, response);
    }
  };
}

function createService(): GitService {
  return {
    commit: vi.fn(async () => undefined),
    getStatus: vi.fn(async () => ({ initialized: false as const })),
    initialize: vi.fn(async () => undefined),
    switchBranch: vi.fn(async () => undefined)
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

function findRouteHandler(router: unknown, method: string, path: string) {
  const layer = (router as {
    stack: {
      route?: {
        methods: Record<string, boolean>;
        path: string;
        stack: { handle: (request: object, response: object) => Promise<void> }[];
      };
    }[];
  }).stack.find((item) => item.route?.path === path && item.route.methods[method]);

  if (!layer?.route) {
    throw new Error(`Route not found: ${method} ${path}`);
  }

  return layer.route.stack[0].handle;
}
