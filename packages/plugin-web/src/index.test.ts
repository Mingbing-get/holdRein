import { describe, expect, it } from "vitest";
import { createWebPluginRegistry } from "./index";
import type { WebPlugin } from "./index";

describe("createWebPluginRegistry", () => {
  it("registers web plugins and returns them in order", () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin = {
      id: "toolbar"
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
  });

  it("rejects duplicate web plugin ids", () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin = {
      id: "toolbar"
    };

    registry.register(plugin);

    expect(() => registry.register(plugin)).toThrow(
      'Web plugin "toolbar" is already registered.'
    );
  });
});
