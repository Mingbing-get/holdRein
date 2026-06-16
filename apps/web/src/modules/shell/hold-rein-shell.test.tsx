// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebPlugin } from "@hold-rein/plugin-web";

import { AppPluginProvider, useAppPlugins } from "../../app/app-plugin";
import { AppUiProvider } from "../../app/app-ui-context";
import { AppWorkspaceProvider } from "../../app/app-workspace-context";
import { AgentTasksProvider } from "../agent-messages";
import { HoldReinShell } from "./hold-rein-shell";

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }

  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }
}

function createMatchMediaMock(): typeof window.matchMedia {
  return ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined
  })) as typeof window.matchMedia;
}

const fetchMock = vi.fn<typeof fetch>();

describe("HoldReinShell plugin settings", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => ({
            code: 0,
            data: { workspaces: [] },
            msg: "ok"
          }),
          ok: true
        } as Response;
      }

      return {
        json: async () => ({
          code: 0,
          data: [],
          msg: "ok"
        }),
        ok: true
      } as Response;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders plugin settings after model configuration and opens the plugin main view", async () => {
    render(
      <AppUiProvider>
        <AppWorkspaceProvider>
          <AgentTasksProvider apiBaseUrl="http://localhost:4000">
            <AppPluginProvider>
              <RegisterPlugin />
              <HoldReinShell apiBaseUrl="http://localhost:4000" />
            </AppPluginProvider>
          </AgentTasksProvider>
        </AppWorkspaceProvider>
      </AppUiProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    const settingsNav = screen.getByLabelText("Settings navigation");
    const settingsButtons = await within(settingsNav).findAllByRole("button");

    expect(settingsButtons.map((button) => button.textContent)).toEqual([
      "返回",
      "模型配置",
      "插件设置"
    ]);

    fireEvent.click(within(settingsNav).getByRole("button", { name: "插件设置" }));

    await waitFor(() => {
      expect(screen.getByTestId("plugin-settings-panel")).toHaveTextContent(
        "Plugin Settings Panel"
      );
    });
    expect(screen.queryByTestId("model-providers-view")).not.toBeInTheDocument();
  });
});

function RegisterPlugin() {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        settings: [
          {
            Render: PluginSettingsPanel,
            id: "settings",
            title: "插件设置"
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

function PluginSettingsPanel() {
  return (
    <section data-testid="plugin-settings-panel">
      Plugin Settings Panel
    </section>
  );
}
