import { describe, expect, it } from "vitest";
import { createServerPluginRegistry } from "./index";
import type { ServerPlugin } from "./index";

describe("createServerPluginRegistry", () => {
  it("registers server plugins and returns them in order", () => {
    const registry = createServerPluginRegistry();
    const plugin: ServerPlugin.Plugin = {
      id: "logger"
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
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
    const calls: string[] = [];
    const router = {
      get(path: string) {
        calls.push(path);
      }
    } as unknown as ServerPlugin.RouteContext["router"];

    registry.register({
      id: "routes",
      registerRoutes({ router: pluginRouter }) {
        pluginRouter.get("/health", (_request, response) => {
          response.status(200).json({ ok: true });
        });
      }
    });

    await registry.registerRoutes({ router });

    expect(calls).toEqual(["/plugin/routes/health"]);
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
});
