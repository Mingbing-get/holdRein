// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";
import { AppPluginProvider, useAppPlugins } from "./app-plugin";
import { AppUiProvider } from "./app-ui-context";

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

function PluginStateProbe() {
  const { turnFooterRenders } = useAppPlugins();

  return (
    <div data-testid="turn-footer-render-ids">
      {turnFooterRenders.map((item) => item.id).join(",")}
    </div>
  );
}
