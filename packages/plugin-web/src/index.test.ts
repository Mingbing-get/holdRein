import { describe, expect, it } from "vitest";
import { createWebPluginRegistry } from "./index";
import type { WebPlugin } from "./index";

describe("createWebPluginRegistry", () => {
  it("registers web plugins and returns them in order", () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin.Plugin = {
      id: "toolbar"
    };

    registry.register(plugin);

    expect(registry.list()).toEqual([plugin]);
  });

  it("rejects duplicate web plugin ids", () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin.Plugin = {
      id: "toolbar"
    };

    registry.register(plugin);

    expect(() => registry.register(plugin)).toThrow(
      'Web plugin "toolbar" is already registered.'
    );
  });

  it("registers plugins with frontend contribution resolvers", async () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        rightPanels: [
          {
            id: "diagnostics",
            Render: () => null,
            title: "Diagnostics"
          }
        ],
        senderActions: [
          {
            id: "attach-context",
            Render: () => null
          }
        ],
        settings: [
          {
            id: "provider-settings",
            Render: () => null,
            title: "Provider settings"
          }
        ],
        toolRenders: [
          {
            Render: () => null,
            toolName: "shell_exec"
          }
        ],
        turnFooterRenders: [
          {
            id: "task-summary",
            Render: () => null
          }
        ]
      },
      id: "ui"
    };

    registry.register(plugin);

    const registered = registry.get("ui");
    expect(registered).toBe(plugin);
  });
});
