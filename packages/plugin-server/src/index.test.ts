import { describe, expect, it } from "vitest";
import { createServerPluginRegistry } from "./index";
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
});
