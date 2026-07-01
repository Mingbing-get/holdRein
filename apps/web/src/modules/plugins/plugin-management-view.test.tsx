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
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PluginManagementView } from "./plugin-management-view";

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

describe("PluginManagementView", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders installed plugins, toggles disabled state, and uninstalls plugins", async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: {
            plugins: [
              {
                disabled: false,
                id: "demo",
                name: "Demo Plugin",
                packageName: "@scope/demo",
                version: "1.0.0",
                webEntry: "/plugin-assets/demo/web.js"
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
            disabled: true,
            id: "demo",
            name: "Demo Plugin",
            packageName: "@scope/demo",
            version: "1.0.0",
            webEntry: "/plugin-assets/demo/web.js"
          },
          msg: "ok"
        }),
        ok: true
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          code: 0,
          data: { id: "demo" },
          msg: "ok"
        }),
        ok: true
      } as Response);

    render(<PluginManagementView apiBaseUrl="http://localhost:4000" />);

    const card = await screen.findByTestId("plugin-card-demo");

    expect(within(card).getByText("Demo Plugin")).toBeVisible();
    expect(within(card).getByText("@scope/demo")).toBeVisible();
    expect(
      within(card).getByRole("button", { name: "卸载 Demo Plugin" })
    ).toBeVisible();
    fireEvent.click(within(card).getByRole("switch", { name: "禁用 Demo Plugin" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/demo",
        {
          body: JSON.stringify({ disabled: true }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH"
        }
      );
    });
    fireEvent.click(
      within(card).getByRole("button", { name: "卸载 Demo Plugin" })
    );
    await screen.findByText("卸载 Demo Plugin");
    const uninstallButtons = screen.getAllByRole("button", { name: /卸\s*载/u });
    const confirmUninstallButton = uninstallButtons.at(-1);

    if (!confirmUninstallButton) {
      throw new Error("Expected uninstall confirmation button");
    }
    fireEvent.click(confirmUninstallButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/demo",
        { method: "DELETE" }
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId("plugin-card-demo")).not.toBeInTheDocument();
    });
  });

  it("installs plugins from npm, github, and a local folder", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/api/v1/file-system/entries")) {
        return {
          json: async () => ({
            code: 0,
            data: {
              entries: [
                {
                  extension: "",
                  kind: "folder",
                  name: "plugin-demo",
                  path: "/Users/me/plugin-demo"
                }
              ],
              parentPath: "/Users/me"
            },
            msg: "ok"
          }),
          ok: true
        } as Response;
      }

      return {
        json: async () => ({ code: 0, data: { plugins: [] }, msg: "ok" }),
        ok: true
      } as Response;
    });

    render(<PluginManagementView apiBaseUrl="http://localhost:4000" />);

    fireEvent.click(await screen.findByRole("button", { name: "安装插件" }));
    fireEvent.change(screen.getByLabelText("npm 包名"), {
      target: { value: "@scope/plugin-demo" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认安装插件" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/install",
        expect.objectContaining({
          body: JSON.stringify({
            source: "@scope/plugin-demo",
            sourceType: "npm"
          })
        })
      );
    });

    cleanup();
    render(<PluginManagementView apiBaseUrl="http://localhost:4000" />);
    fireEvent.click(screen.getByRole("button", { name: "安装插件" }));
    fireEvent.click(screen.getByText("GitHub"));
    fireEvent.change(screen.getByLabelText("GitHub 仓库地址"), {
      target: { value: "https://github.com/acme/plugin-demo.git" }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认安装插件" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/install",
        expect.objectContaining({
          body: JSON.stringify({
            source: "https://github.com/acme/plugin-demo.git",
            sourceType: "github"
          })
        })
      );
    });

    cleanup();
    render(<PluginManagementView apiBaseUrl="http://localhost:4000" />);
    const githubTreeSource =
      "https://github.com/Mingbing-get/holdRein/tree/main/packages/plugins/ts-standards";
    fireEvent.click(screen.getByRole("button", { name: "安装插件" }));
    fireEvent.click(screen.getByText("GitHub"));
    fireEvent.change(screen.getByLabelText("GitHub 仓库地址"), {
      target: { value: githubTreeSource }
    });
    fireEvent.click(screen.getByRole("button", { name: "确认安装插件" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/install",
        expect.objectContaining({
          body: JSON.stringify({
            source: githubTreeSource,
            sourceType: "github"
          })
        })
      );
    });

    cleanup();
    render(<PluginManagementView apiBaseUrl="http://localhost:4000" />);
    fireEvent.click(screen.getByRole("button", { name: "安装插件" }));
    fireEvent.click(screen.getByText("本地"));

    fireEvent.click(screen.getByLabelText("本地插件文件夹"));
    const localFolderRow = await screen.findByTestId(
      "file-selector-entry-plugin-demo"
    );
    fireEvent.click(
      within(localFolderRow).getByRole("button", {
        name: "plugin-demo folder selectable"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    fireEvent.click(screen.getByRole("button", { name: "确认安装插件" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/v1/plugins/install",
        expect.objectContaining({
          body: JSON.stringify({
            source: "/Users/me/plugin-demo",
            sourceType: "local"
          })
        })
      );
    });
  });
});
