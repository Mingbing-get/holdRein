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

vi.mock("./config/env", () => ({
  getAppEnv: () => ({
    apiBaseUrl: "http://localhost:4000"
  })
}));

import App from "./App";

const fetchMock = vi.fn<typeof fetch>();

const emptyWorkspaceNavigationResponse = {
  code: 0,
  msg: "ok",
  data: {
    workspaces: []
  }
};

const workspaceNavigationResponse = {
  code: 0,
  msg: "ok",
  data: {
    workspaces: [
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/Users/mingbing/apps/workspace-one",
        tasks: [
          {
            id: "task-one",
            initialUserMessage: "First task",
            lastContinuedAt: "2026-06-08T08:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "First task"
          }
        ]
      },
      {
        hasMore: false,
        id: "workspace-two",
        name: "Workspace Two",
        path: "/Users/mingbing/apps/workspace-two",
        tasks: [
          {
            id: "task-two",
            initialUserMessage: "Second task",
            lastContinuedAt: "2026-06-08T09:00:00.000Z",
            lastModelName: "gpt-4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "Second task"
          }
        ]
      }
    ]
  }
};

const modelProvidersResponse = {
  code: 0,
  msg: "ok",
  data: []
};

describe("App", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      json: async () => modelProvidersResponse,
      ok: true
    } as Response);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => emptyWorkspaceNavigationResponse,
          ok: true
        } as Response;
      }

      return {
        json: async () => modelProvidersResponse,
        ok: true
      } as Response;
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("renders the workspace shell with top bar actions", async () => {
    render(<App />);
    const sidebar = screen.getByLabelText("Workspace sidebar");
    const topBar = screen.getByTestId("workspace-top-bar");

    expect(sidebar).toBeInTheDocument();
    expect(within(topBar).queryByText("Engineering Hub")).not.toBeInTheDocument();
    expect(
      within(topBar).getByRole("button", { name: "Collapse sidebar" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open settings" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Model configuration" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Toggle theme" })
    ).toBeInTheDocument();
    expect(topBar).toHaveStyle({ padding: "8px 16px" });
    expect(document.body).toHaveStyle({
      background: "var(--app-color-bg-base)"
    });
  });

  it("toggles the app theme from light to dark", () => {
    render(<App />);

    expect(document.documentElement.dataset.themeMode).toBe("light");

    fireEvent.click(screen.getByRole("switch", { name: "Toggle theme" }));

    expect(document.documentElement.dataset.themeMode).toBe("dark");
    expect(screen.getByRole("switch", { name: "Toggle theme" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("shows a tooltip for the settings action", async () => {
    render(<App />);

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Open settings" }));
    expect(await screen.findByText("设置")).toBeInTheDocument();
  });

  it("toggles an empty right sidebar from the chat top bar action", async () => {
    render(<App />);

    expect(screen.queryByLabelText("Chat right sidebar")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "隐藏/显示右侧边栏" }));
    expect(await screen.findByText("隐藏/显示右侧边栏")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "隐藏/显示右侧边栏" }));

    const rightSidebar = screen.getByLabelText("Chat right sidebar");

    expect(rightSidebar).toBeInTheDocument();
    expect(rightSidebar).toHaveStyle({ width: "320px" });
  });

  it("lets the chat right sidebar border span the content height", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "隐藏/显示右侧边栏" }));

    expect(screen.getByRole("main")).toHaveStyle({ padding: "0px" });
    expect(screen.getByLabelText("Chat right sidebar")).toHaveStyle({
      padding: "10px 14px 14px 12px"
    });
  });

  it("opens settings navigation with model providers selected and restores workspace navigation", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => workspaceNavigationResponse,
          ok: true
        } as Response;
      }

      return {
        json: async () => modelProvidersResponse,
        ok: true
      } as Response;
    });

    render(<App />);

    expect(await screen.findByTestId("workspace-task-task-one")).toHaveTextContent(
      "First task"
    );
    fireEvent.click(screen.getByTestId("workspace-task-task-two"));

    await waitFor(() => {
      expect(screen.getByTestId("chat-workspace")).toHaveAttribute(
        "data-task-name",
        "Second task"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));

    expect(
      screen.queryByRole("button", { name: "隐藏/显示右侧边栏" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Workspace navigation")
    ).not.toBeInTheDocument();
    const settingsNav = screen.getByLabelText("Settings navigation");
    expect(
      within(settingsNav).getByRole("button", { name: "返回工作区导航" })
    ).toBeInTheDocument();
    expect(await screen.findByTestId("model-providers-view")).toBeInTheDocument();

    fireEvent.click(
      within(settingsNav).getByRole("button", { name: "返回工作区导航" })
    );

    expect(screen.getByLabelText("Workspace navigation")).toBeInTheDocument();
    expect(screen.queryByLabelText("Settings navigation")).not.toBeInTheDocument();
    expect(screen.getByTestId("chat-workspace")).toHaveAttribute(
      "data-task-name",
      "Second task"
    );
  });

  it("shows the sidebar workspaces in the chat workspace selector", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => workspaceNavigationResponse,
          ok: true
        } as Response;
      }

      return {
        json: async () => modelProvidersResponse,
        ok: true
      } as Response;
    });

    render(<App />);

    expect(await screen.findByTestId("workspace-task-task-one")).toHaveTextContent(
      "First task"
    );
    expect(screen.getByTestId("workspace-task-task-two")).toHaveTextContent(
      "Second task"
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工作空间" }));

    expect(
      await screen.findByRole("option", {
        hidden: true,
        name: "Workspace One"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        hidden: true,
        name: "Workspace Two"
      })
    ).toBeInTheDocument();
  });

  it("keeps a new conversation blank in the active workspace", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => workspaceNavigationResponse,
          ok: true
        } as Response;
      }

      return {
        json: async () => modelProvidersResponse,
        ok: true
      } as Response;
    });

    render(<App />);

    expect(await screen.findByTestId("chat-workspace")).toHaveAttribute(
      "data-task-name",
      "First task"
    );

    const newTaskButton = screen.getByRole("button", { name: "开启新任务" });

    await waitFor(() => {
      expect(newTaskButton).toBeEnabled();
    });
    fireEvent.click(newTaskButton);

    await waitFor(() => {
      expect(screen.getByTestId("chat-workspace")).toHaveAttribute(
        "data-task-name",
        ""
      );
    });
  });

  it("switches the active workspace from the workspace selector", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.endsWith("/api/v1/workspaces/recent-tasks")) {
        return {
          json: async () => workspaceNavigationResponse,
          ok: true
        } as Response;
      }

      if (url.endsWith("/api/v1/file-system/entries")) {
        return {
          json: async () => ({
            code: 0,
            data: {
              parentPath: "/Users/mingbing/apps",
              entries: [
                {
                  extension: "",
                  kind: "folder",
                  name: "workspace-two",
                  path: "/Users/mingbing/apps/workspace-two"
                }
              ]
            },
            msg: "ok"
          }),
          ok: true
        } as Response;
      }

      return {
        json: async () => modelProvidersResponse,
        ok: true
      } as Response;
    });

    render(<App />);

    expect(await screen.findByTestId("workspace-task-task-one")).toHaveTextContent(
      "First task"
    );

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工作空间" }));
    fireEvent.click(await screen.findByRole("button", { name: "选择工作空间" }));

    const row = await screen.findByTestId("file-selector-entry-workspace-two");
    fireEvent.click(
      within(row).getByRole("button", {
        name: "workspace-two folder selectable"
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "确定" }));

    await waitFor(() => {
      expect(screen.getByTestId("workspace-task-task-two").style.background).not.toBe(
        ""
      );
    });
    expect(
      screen.getByRole("combobox", { name: "工作空间" }).parentElement
    ).toHaveTextContent("Workspace Two");
  });

  it("collapses the workspace sidebar", async () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(
      screen.getByRole("button", { name: "Expand sidebar" })
    ).toBeVisible();
    expect(sidebar).not.toBeVisible();
  });

  it("resizes the workspace sidebar from its right border within bounds", () => {
    render(<App />);

    const sidebar = screen.getByLabelText("Workspace sidebar");
    const workspaceLayout = screen.getByTestId("workspace-main-layout");
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize workspace sidebar"
    });

    expect(sidebar).toHaveStyle({ width: "240px" });
    expect(resizeHandle).toHaveStyle({ cursor: "col-resize" });

    fireEvent.mouseEnter(resizeHandle);

    expect(sidebar.style.borderRight).toBe(
      "1px solid var(--app-color-primary)"
    );

    fireEvent.mouseDown(resizeHandle, { clientX: 240 });

    expect(sidebar).toHaveStyle({ transition: "transform 0.2s ease" });
    expect(workspaceLayout).toHaveStyle({ transition: "none" });

    fireEvent.mouseMove(document, { clientX: 800 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "680px" });

    fireEvent.mouseDown(resizeHandle, { clientX: 680 });
    fireEvent.mouseMove(document, { clientX: 0 });
    fireEvent.mouseUp(document);

    expect(sidebar).toHaveStyle({ width: "120px" });
  });

  it("resizes the chat right sidebar from its left border within bounds", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "隐藏/显示右侧边栏" }));

    const rightSidebar = screen.getByLabelText("Chat right sidebar");
    const resizeHandle = screen.getByRole("separator", {
      name: "Resize chat right sidebar"
    });

    expect(rightSidebar).toHaveStyle({ width: "320px" });
    expect(resizeHandle).toHaveStyle({ cursor: "col-resize" });

    fireEvent.mouseEnter(resizeHandle);

    expect(rightSidebar.style.borderLeft).toBe(
      "1px solid var(--app-color-primary)"
    );

    fireEvent.mouseDown(resizeHandle, { clientX: 700 });
    fireEvent.mouseMove(document, { clientX: 200 });
    fireEvent.mouseUp(document);

    expect(rightSidebar).toHaveStyle({ width: "640px" });

    fireEvent.mouseDown(resizeHandle, { clientX: 200 });
    fireEvent.mouseMove(document, { clientX: 900 });
    fireEvent.mouseUp(document);

    expect(rightSidebar).toHaveStyle({ width: "220px" });
  });
});
