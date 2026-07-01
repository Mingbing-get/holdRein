import { afterEach, describe, expect, it } from "vitest";
import {
  clearBrowserToolExecutorsForTests,
  createWebPluginRegistry,
  executeBrowserTool,
  registerBrowserToolExecutor
} from "./index";
import type { WebPlugin } from "./index";

describe("createWebPluginRegistry", () => {
  afterEach(() => {
    clearBrowserToolExecutorsForTests();
  });

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

  it("unregisters web plugins for runtime reloads", () => {
    const registry = createWebPluginRegistry();
    const plugin: WebPlugin.Plugin = {
      id: "toolbar"
    };

    registry.register(plugin);

    expect(registry.unregister("toolbar")).toBe(true);
    expect(registry.unregister("toolbar")).toBe(false);
    expect(registry.has("toolbar")).toBe(false);
    expect(registry.list()).toEqual([]);
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
        tools: [
          {
            description: "Read selected browser text.",
            executor: () => "Selected text",
            name: "read_browser_selection",
            params: { type: "object" } as WebPlugin.BrowserRuntimeTool["params"]
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

  it("executes registered browser tool executors", async () => {
    registerBrowserToolExecutor("read_browser_selection", () => "Selected text");

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({ content: "Selected text", isError: false });
  });

  it("executes browser tools after optional beforeExecute allows execution", async () => {
    const beforeExecute: WebPlugin.BrowserToolBeforeExecute = async ({
      requestApproval
    }) => requestApproval("Allow selection access?");

    registerBrowserToolExecutor(
      "read_browser_selection",
      () => "Selected text",
      beforeExecute
    );

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        requestApproval: async () => undefined,
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({ content: "Selected text", isError: false });
  });

  it("returns a tool error without executing when optional beforeExecute blocks", async () => {
    let executed = false;

    registerBrowserToolExecutor(
      "read_browser_selection",
      () => {
        executed = true;
        return "Selected text";
      },
      async ({ requestApproval }) => requestApproval("Allow selection access?")
    );

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        requestApproval: async () => ({
          block: true,
          reason: "User rejected browser selection access."
        }),
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({
      content: "User rejected browser selection access.",
      isError: true
    });
    expect(executed).toBe(false);
  });

  it("provides a default approval requester for browser tools without one", async () => {
    const beforeExecute = async ({ requestApproval }: WebPlugin.BrowserToolBeforeExecuteOptions) =>
      requestApproval("Allow selection access?");

    registerBrowserToolExecutor(
      "read_browser_selection",
      () => "Selected text",
      beforeExecute
    );

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({ content: "Selected text", isError: false });
  });
});
