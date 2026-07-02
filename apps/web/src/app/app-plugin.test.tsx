// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";
import { clearBrowserToolExecutorsForTests, executeBrowserTool } from "@hold-rein/plugin-web";
import { AppPluginProvider, useAppPlugins } from "./app-plugin";
import { AppUiProvider, useAppUi } from "./app-ui-context";

const fetchMock = vi.fn<typeof fetch>();

describe("AppPluginProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      json: async () => ({ code: 0, data: { plugins: [] }, msg: "ok" }),
      ok: true
    } as Response);
  });

  afterEach(() => {
    clearBrowserToolExecutorsForTests();
    cleanup();
    fetchMock.mockReset();
  });

  it("adds plugin-prefixed turn footer renders to the plugin context", async () => {
    render(
      <AppUiProvider>
        <AppPluginProvider>
          <RegisterPlugin />
          <PluginStateProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("turn-footer-render-ids")).toHaveTextContent(
        "demo_task-summary"
      );
    });
  });

  it("does not reload function contributions when app ui changes", async () => {
    const resolverQueue: ((contribution: WebPlugin.Contribution) => void)[] =
      [];
    let toggleThemeMode: (() => void) | undefined;
    const contribution: WebPlugin.Contribution = {
      turnFooterRenders: [
        {
          id: "task-summary",
          Render: () => null
        }
      ]
    };

    render(
      <AppUiProvider>
        <AppPluginProvider>
          <RegisterAsyncPlugin resolverQueue={resolverQueue} />
          <CaptureToggleThemeMode onCapture={(toggle) => {
            toggleThemeMode = toggle;
          }} />
          <PluginStateProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(resolverQueue).toHaveLength(1);
    });

    act(() => {
      toggleThemeMode?.();
    });

    expect(resolverQueue).toHaveLength(1);

    await act(async () => {
      resolverQueue[0]?.(contribution);
    });

    await waitFor(() => {
      const renderIds = screen
        .getByTestId("turn-footer-render-ids")
        .textContent?.split(",")
        .filter((id) => id === "async-demo_task-summary");

      expect(renderIds).toEqual(["async-demo_task-summary"]);
    });
  });

  it("lets function contributions subscribe to app ui changes", async () => {
    const observedThemeModes: WebPlugin.ThemeMode[] = [];
    let toggleThemeMode: (() => void) | undefined;

    render(
      <AppUiProvider>
        <AppPluginProvider>
          <RegisterSubscriptionPlugin onThemeMode={(themeMode) => {
            observedThemeModes.push(themeMode);
          }} />
          <CaptureToggleThemeMode onCapture={(toggle) => {
            toggleThemeMode = toggle;
          }} />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(observedThemeModes).toHaveLength(1);
    });

    const initialThemeMode = observedThemeModes[0];
    const nextThemeMode = initialThemeMode === "light" ? "dark" : "light";

    act(() => {
      toggleThemeMode?.();
    });

    await waitFor(() => {
      expect(observedThemeModes).toEqual([initialThemeMode, nextThemeMode]);
    });
  });

  it("collects runtime contributions and registers browser tool executors", async () => {
    const executor = vi.fn().mockResolvedValue("Selected text");

    render(
      <AppUiProvider>
        <AppPluginProvider>
          <RegisterRuntimePlugin executor={executor} />
          <RuntimeContributionProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        "read_browser_selection:runtime-demo,browser-context:runtime-demo,Prefer browser tools.:runtime-demo"
      );
    });

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({ content: "Selected text", isError: false });
    expect(executor).toHaveBeenCalled();
  });

  it("reloads runtime plugins and removes contributions for disabled manifests", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            plugins: [
              {
                disabled: false,
                id: "runtime-demo",
                name: "Runtime Demo",
                packageName: "@scope/runtime-demo",
                version: "1.0.0",
                webEntry: "/plugin-assets/runtime-demo/web.js"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            plugins: [
              {
                disabled: true,
                id: "runtime-demo",
                name: "Runtime Demo",
                packageName: "@scope/runtime-demo",
                version: "1.0.0",
                webEntry: "/plugin-assets/runtime-demo/web.js"
              }
            ]
          },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(
      <AppUiProvider>
        <AppPluginProvider runtimePluginImporter={async () => ({
          contributionResolver: {
            systemPrompts: ["Runtime prompt."]
          },
          id: "runtime-demo"
        })}>
          <ReloadRuntimePluginsButton />
          <RuntimeContributionProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        "Runtime prompt."
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "重新加载插件" }));

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        ",,"
      );
    });
  });

  it("tracks imported runtime plugin ids when reloading plugins", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        code: 0,
        data: {
          plugins: [
            {
              disabled: false,
              id: "manifest-demo",
              name: "Runtime Demo",
              packageName: "@scope/runtime-demo",
              version: "1.0.0",
              webEntry: "/plugin-assets/runtime-demo/web.js"
            }
          ]
        },
        msg: "ok"
      }),
      ok: true
    } as Response);

    render(
      <AppUiProvider>
        <AppPluginProvider runtimePluginImporter={async () => ({
          contributionResolver: {
            systemPrompts: ["Runtime prompt."]
          },
          id: "module-demo"
        })}>
          <ReloadRuntimePluginsButton />
          <RuntimeContributionProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        "Runtime prompt."
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "重新加载插件" }));

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        "Runtime prompt."
      );
    });
  });

  it("registers browser tool beforeExecute hooks from runtime contributions", async () => {
    const executor = vi.fn().mockResolvedValue("Selected text");
    const beforeExecute = vi.fn().mockResolvedValue({
      block: true,
      reason: "Selection access denied."
    });

    render(
      <AppUiProvider>
        <AppPluginProvider>
          <RegisterRuntimePlugin
            beforeExecute={beforeExecute}
            executor={executor}
          />
          <RuntimeContributionProbe />
        </AppPluginProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("runtime-contributions")).toHaveTextContent(
        "read_browser_selection:runtime-demo,browser-context:runtime-demo,Prefer browser tools.:runtime-demo"
      );
    });

    await expect(
      executeBrowserTool({
        agentId: "agent-1",
        arguments: { scope: "selection" },
        taskId: "task-1",
        toolCallId: "tool-call-1",
        toolName: "read_browser_selection"
      })
    ).resolves.toEqual({
      content: "Selection access denied.",
      isError: true
    });
    expect(beforeExecute).toHaveBeenCalled();
    expect(executor).not.toHaveBeenCalled();
  });
});

function RegisterPlugin() {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        turnFooterRenders: [
          {
            id: "task-summary",
            Render: () => null
          }
        ]
      },
      id: "demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [pluginRegistry]);

  return null;
}

function RegisterAsyncPlugin({
  resolverQueue
}: {
  resolverQueue: ((contribution: WebPlugin.Contribution) => void)[];
}) {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: () =>
        new Promise<WebPlugin.Contribution>((resolve) => {
          resolverQueue.push(resolve);
        }),
      id: "async-demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [pluginRegistry, resolverQueue]);

  return null;
}

function RegisterSubscriptionPlugin({
  onThemeMode
}: {
  onThemeMode: (themeMode: WebPlugin.ThemeMode) => void;
}) {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: ({ subscribeAppUi }) => {
        subscribeAppUi((appUi) => {
          onThemeMode(appUi.state.themeMode);
        });

        return {};
      },
      id: "subscription-demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [onThemeMode, pluginRegistry]);

  return null;
}

function RegisterRuntimePlugin({
  beforeExecute,
  executor
}: {
  beforeExecute?: WebPlugin.BrowserToolBeforeExecute;
  executor: WebPlugin.BrowserToolExecutor;
}) {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        skills: [
          {
            content: "# Browser Context",
            name: "browser-context"
          }
        ],
        systemPrompts: ["Prefer browser tools."],
        tools: [
          {
            ...(beforeExecute === undefined ? {} : { beforeExecute }),
            description: "Read selected browser text.",
            executor,
            name: "read_browser_selection",
            params: { type: "object" } as WebPlugin.BrowserRuntimeTool["params"]
          }
        ]
      },
      id: "runtime-demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [executor, pluginRegistry]);

  return null;
}

function CaptureToggleThemeMode({
  onCapture
}: {
  onCapture: (toggleThemeMode: () => void) => void;
}) {
  const appUi = useAppUi();

  useEffect(() => {
    onCapture(appUi.toggleThemeMode);
  }, [appUi.toggleThemeMode, onCapture]);

  return null;
}

function PluginStateProbe() {
  const { turnFooterRenders } = useAppPlugins();

  return (
    <div data-testid="turn-footer-render-ids">
      {turnFooterRenders.map((item) => item.id).join(",")}
    </div>
  );
}

function RuntimeContributionProbe() {
  const { runtimeContributions } = useAppPlugins();

  return (
    <div data-testid="runtime-contributions">
      {[
        runtimeContributions.tools.map((tool) => `${tool.name}:${tool.pluginId ?? ""}`).join("|"),
        runtimeContributions.skills.map((skill) => `${skill.name}:${skill.pluginId ?? ""}`).join("|"),
        runtimeContributions.systemPrompts.map((prompt) => `${prompt.content}:${prompt.pluginId ?? ""}`).join("|")
      ].join(",")}
    </div>
  );
}

function ReloadRuntimePluginsButton() {
  const { reloadRuntimePlugins } = useAppPlugins();

  return (
    <button onClick={() => {
      void reloadRuntimePlugins();
    }} type="button">
      重新加载插件
    </button>
  );
}
