// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { WebPlugin } from "@hold-rein/plugin-web";
import { AppPluginProvider, useAppPlugins } from "./app-plugin";
import { AppUiProvider } from "./app-ui-context";

const runtimePlugin: WebPlugin.Plugin = {
  id: "runtime",
  contributionResolver: {
    settings: [
      {
        id: "settings",
        title: "Runtime Settings",
        Render: () => null
      }
    ]
  }
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("loads runtime web plugins from the API", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: 20000,
      msg: "Success",
      data: {
        plugins: [
          {
            id: "runtime",
            name: "Runtime",
            packageName: "@scope/runtime",
            version: "1.0.0",
            webEntry: "/plugin-assets/runtime/web/index.js"
          }
        ]
      }
    })
  } as Response));

  render(
    <AppUiProvider>
      <AppPluginProvider
        runtimePluginImporter={vi.fn(async () => runtimePlugin)}
      >
        <SettingsProbe />
      </AppPluginProvider>
    </AppUiProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId("settings")).toHaveTextContent(
      "runtime_settings"
    );
  });
});

function SettingsProbe() {
  const { settings } = useAppPlugins();

  return (
    <div data-testid="settings">
      {settings.map((setting) => setting.id).join(",")}
    </div>
  );
}
