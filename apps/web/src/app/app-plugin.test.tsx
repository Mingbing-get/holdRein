// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";
import { AppPluginProvider, useAppPlugins } from "./app-plugin";
import { AppUiProvider, useAppUi } from "./app-ui-context";

describe("AppPluginProvider", () => {
  afterEach(() => {
    cleanup();
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
    const resolverQueue: Array<(contribution: WebPlugin.Contribution) => void> =
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
  resolverQueue: Array<(contribution: WebPlugin.Contribution) => void>;
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
