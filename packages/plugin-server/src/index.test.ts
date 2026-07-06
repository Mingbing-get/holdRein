import { describe, expect, it, vi } from "vitest";
import {
  createServerPluginRegistry,
  SERVER_PLUGIN_SHARED_PACKAGES
} from "./index";
import type { ServerPlugin } from "./index";

describe("createServerPluginRegistry", () => {
  it("exports server shared packages", () => {
    expect(SERVER_PLUGIN_SHARED_PACKAGES).toEqual([
      "@hold-rein/plugin-server",
      "@earendil-works/pi-agent-core",
      "@earendil-works/pi-ai",
      "express"
    ]);
  });

  it("types server plugins with optional disposal hooks", () => {
    const disposed: string[] = [];
    const plugin: ServerPlugin.Plugin = {
      dispose() {
        disposed.push("demo");
      },
      id: "demo"
    };

    plugin.dispose?.();

    expect(disposed).toEqual(["demo"]);
  });

  it("registers server plugins and returns them in order", () => {
    const registry = createServerPluginRegistry();
    const plugin: ServerPlugin.Plugin = {
      id: "logger"
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
  });

  it("replaces registered server plugins for runtime reloads", () => {
    const registry = createServerPluginRegistry();
    const firstPlugin: ServerPlugin.Plugin = {
      id: "first"
    };
    const secondPlugin: ServerPlugin.Plugin = {
      id: "second"
    };

    registry.register(firstPlugin);
    registry.replaceAll([secondPlugin]);

    expect(registry.has("first")).toBe(false);
    expect(registry.has("second")).toBe(true);
    expect(registry.list()).toEqual([secondPlugin]);
  });

  it("rejects duplicate server plugin ids", () => {
    const registry = createServerPluginRegistry();
    const plugin: ServerPlugin.Plugin = {
      id: "logger"
    };

    registry.register(plugin);

    expect(() => registry.register(plugin)).toThrow(
      'Server plugin "logger" is already registered.'
    );
  });

  it("registers each plugin route below the plugin id prefix", async () => {
    const registry = createServerPluginRegistry();
    const mountedRoutes: { path: string; route: unknown }[] = [];
    const prefixRouter = {
      use(path: string, route: unknown) {
        mountedRoutes.push({ path, route });
      }
    };
    const pluginRoute = { route: "plugin-route" };
    const context = {} as ServerPlugin.RouteContext;

    registry.register({
      id: "routes",
      registerRoutes(routeContext) {
        expect(routeContext).toBe(context);

        return pluginRoute as never;
      }
    });

    await registry.registerRoutes(prefixRouter as never, context);

    expect(mountedRoutes).toEqual([{ path: "/routes", route: pluginRoute }]);
  });

  it("resolves and merges plugin contributions in registration order", async () => {
    const registry = createServerPluginRegistry();
    const subscribeCalls: string[] = [];
    const toolA = { name: "tool-a" } as ServerPlugin.PluginTool;
    const toolB = { name: "tool-b" } as ServerPlugin.PluginTool;
    const skillA = { name: "skill-a" } as ServerPlugin.Contribution["skills"][number];
    const skillB = { name: "skill-b" } as ServerPlugin.Contribution["skills"][number];
    const context = {} as ServerPlugin.RuntimeContext;
    const event = { type: "agent-started" } as Parameters<
      NonNullable<ServerPlugin.Contribution["subscribe"]>
    >[0];

    registry.register({
      id: "static",
      contributionResolver: {
        tools: [toolA],
        skills: [skillA],
        skillDirs: ["/skills/a"],
        systemPrompts: ["Prompt A"],
        subscribe() {
          subscribeCalls.push("static");
        }
      }
    });
    registry.register({
      id: "dynamic",
      contributionResolver(runtimeContext) {
        expect(runtimeContext).toBe(context);

        return {
          tools: [toolB],
          skills: [skillB],
          skillDirs: ["/skills/b"],
          systemPrompts: ["Prompt B"],
          subscribe() {
            subscribeCalls.push("dynamic");
          }
        };
      }
    });

    const contribution = await registry.resolveContributions(context);

    expect(contribution).toMatchObject({
      tools: [toolA, toolB],
      skills: [skillA, skillB],
      skillDirs: ["/skills/a", "/skills/b"],
      systemPrompts: ["Prompt A", "Prompt B"]
    });

    contribution.subscribe?.(event);
    expect(subscribeCalls).toEqual(["static", "dynamic"]);
  });

  it("resolves contributions only for active plugin package names when provided", async () => {
    const registry = createServerPluginRegistry();
    const activeResolver = vi.fn().mockReturnValue({
      systemPrompts: ["Active prompt"],
      tools: [{ name: "active-tool" }]
    });
    const inactiveResolver = vi.fn().mockReturnValue({
      systemPrompts: ["Inactive prompt"],
      tools: [{ name: "inactive-tool" }]
    });

    registry.register({
      id: "active-plugin",
      packageName: "@scope/active-plugin",
      contributionResolver: activeResolver
    });
    registry.register({
      id: "inactive-plugin",
      packageName: "@scope/inactive-plugin",
      contributionResolver: inactiveResolver
    });

    const contribution = await registry.resolveContributions(
      {} as ServerPlugin.RuntimeContext,
      { activePluginPackageNames: ["@scope/active-plugin"] }
    );

    expect(activeResolver).toHaveBeenCalledOnce();
    expect(inactiveResolver).not.toHaveBeenCalled();
    expect(contribution.systemPrompts).toEqual(["Active prompt"]);
    expect(contribution.tools?.map((tool) => tool.name)).toEqual([
      "active-tool"
    ]);
  });

  it("falls back to the plugin id when no package name is available", async () => {
    const registry = createServerPluginRegistry();
    const resolver = vi.fn().mockReturnValue({ systemPrompts: ["Prompt"] });

    registry.register({
      id: "direct-plugin",
      contributionResolver: resolver
    });

    await registry.resolveContributions(
      {} as ServerPlugin.RuntimeContext,
      { activePluginPackageNames: ["direct-plugin"] }
    );

    expect(resolver).toHaveBeenCalledOnce();
  });

  it("uses the first plugin agent-end continuation in descending priority order", async () => {
    const registry = createServerPluginRegistry();
    const calls: string[] = [];
    const context = {} as ServerPlugin.RuntimeContext;
    const input = {
      messages: [],
      runInput: {
        modelId: "gpt-4.1",
        prompt: "Inspect",
        provider: "openai",
        taskId: "task-1",
        workspacePath: "/workspace"
      },
      session: {
        createdAt: "now",
        id: "session-1",
        path: "/sessions/session-1.jsonl"
      }
    };

    registry.register({
      id: "default-priority",
      contributionResolver: {
        onAgentEnd() {
          calls.push("default-priority");
          return undefined;
        }
      }
    });
    registry.register({
      id: "negative-priority",
      contributionResolver: {
        agentEndPriority: -1,
        onAgentEnd() {
          calls.push("negative-priority");
          return { prompt: "Continue" };
        }
      }
    });
    registry.register({
      id: "high-priority-first",
      contributionResolver: {
        agentEndPriority: 10,
        onAgentEnd() {
          calls.push("high-priority-first");
          return undefined;
        }
      }
    });
    registry.register({
      id: "high-priority-second",
      contributionResolver: {
        agentEndPriority: 10,
        onAgentEnd() {
          calls.push("high-priority-second");
          return undefined;
        }
      }
    });

    const contribution = await registry.resolveContributions(context);

    await expect(contribution.onAgentEnd?.(input)).resolves.toEqual({
      prompt: "Continue"
    });
    expect(calls).toEqual([
      "high-priority-first",
      "high-priority-second",
      "default-priority",
      "negative-priority"
    ]);
  });
});
