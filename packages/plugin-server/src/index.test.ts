import { describe, expect, it } from "vitest";
import {
  createServerPluginRegistry,
  mountServerPluginRoutes
} from "./index";
import type { ServerPlugin } from "./index";

describe("createServerPluginRegistry", () => {
  it("registers server plugins and returns them in order", () => {
    const registry = createServerPluginRegistry();
    const plugin: ServerPlugin = {
      id: "logger",
      setup: () => undefined
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
  });

  it("rejects duplicate server plugin ids", () => {
    const registry = createServerPluginRegistry();
    const plugin: ServerPlugin = {
      id: "logger",
      setup: () => undefined
    };

    registry.register(plugin);

    expect(() => registry.register(plugin)).toThrow(
      'Server plugin "logger" is already registered.'
    );
  });

  it("mounts routes contributed by a server plugin", () => {
    const calls: string[] = [];
    const router = {
      get(path: string) {
        calls.push(path);
      }
    };
    const plugin: ServerPlugin = {
      id: "routes",
      registerRoutes(pluginRouter) {
        pluginRouter.get("/health", () => undefined);
      }
    };

    mountServerPluginRoutes(router, plugin, {});

    expect(calls).toEqual(["/health"]);
  });
});
