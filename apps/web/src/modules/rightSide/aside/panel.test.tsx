// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AppPluginProvider, useAppPlugins } from "../../../app/app-plugin";
import { AppUiProvider } from "../../../app/app-ui-context";
import { AppWorkspaceProvider, useAppWorkspace } from "../../../app/app-workspace-context";
import { AgentTasksProvider } from "../../agent-messages";
import RightPanel from "./panel";

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

describe("RightPanel", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", createMatchMediaMock());
    vi.stubGlobal("fetch", fetchMock);
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      json: async () => ({ code: 0, data: [], msg: "ok" }),
      ok: true
    } as Response);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders plugin right panels as compact top icon tabs and switches the active render", async () => {
    renderRightPanel();

    await waitFor(() => {
      expect(screen.getByTestId("inspector-panel")).toHaveTextContent(
        "inspector:task-1:idle:0"
      );
    });

    const switcher = screen.getByRole("tablist", {
      name: "Plugin right panel tabs"
    });

    expect(switcher.style.borderBottom).toBe(
      "1px solid var(--app-color-border-secondary)"
    );
    const inspectorTab = screen.getByRole("tab", { name: "检查器" });
    const runsTab = screen.getByRole("tab", { name: "运行详情" });
    const allTabs = screen.getAllByRole("tab");
    const separators = screen.getAllByRole("separator", {
      name: "Plugin right panel separator"
    });

    expect(separators).toHaveLength(allTabs.length - 1);
    for (const separator of separators) {
      expect(separator).toHaveStyle({
        background: "var(--app-color-border-secondary)"
      });
    }

    expect(inspectorTab).toHaveTextContent("I");
    expect(runsTab).toHaveTextContent("R");
    expect(runsTab).toHaveStyle({
      background: "transparent",
      color: "var(--app-color-text-secondary)"
    });
    expect(runsTab.style.border).toBe("0px");

    fireEvent.mouseEnter(runsTab);

    expect(runsTab).toHaveStyle({
      background: "var(--app-color-fill-secondary)",
      color: "var(--app-color-text)"
    });
    expect(inspectorTab).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(runsTab).toHaveAttribute(
      "aria-selected",
      "false"
    );

    fireEvent.click(runsTab);

    expect(screen.getByTestId("runs-panel")).toHaveTextContent(
      "runs:workspace-1:no-agent"
    );
    expect(screen.getByRole("tab", { name: "运行详情" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.queryByTestId("inspector-panel")).not.toBeInTheDocument();
  });

  it("uses theme CSS variables without adding an extra framed shell", async () => {
    renderRightPanel();

    const shell = await screen.findByLabelText("Plugin right panels");

    expect(shell).toHaveStyle({
      color: "var(--app-color-text)"
    });
    expect(shell.style.background).toBe("");
    expect(shell.style.border).toBe("");
  });
});

function renderRightPanel() {
  render(
    <AppUiProvider>
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="http://localhost:4000">
          <AppPluginProvider>
            <RegisterRightPanels />
            <SelectWorkspace />
            <RightPanel />
          </AppPluginProvider>
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}

function RegisterRightPanels() {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        rightPanels: [
          {
            Render: InspectorPanel,
            icon: <span aria-hidden="true">I</span>,
            id: "inspector",
            title: "检查器"
          },
          {
            Render: RunsPanel,
            icon: <span aria-hidden="true">R</span>,
            id: "runs",
            title: "运行详情"
          }
        ]
      },
      id: "right-panel-demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [pluginRegistry]);

  return null;
}

function SelectWorkspace() {
  const { setActiveTaskId, setActiveWorkspaceId, setWorkspaces } =
    useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "Workspace",
        path: "/tmp/workspace",
        tasks: [
          {
            id: "task-1",
            initialUserMessage: "Inspect",
            lastContinuedAt: "2026-06-17T00:00:00.000Z",
            lastModelName: "GPT",
            lastModelProvider: "OpenAI",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "Task"
          }
        ]
      }
    ]);
    setActiveWorkspaceId("workspace-1");
    setActiveTaskId("task-1");
  }, [setActiveTaskId, setActiveWorkspaceId, setWorkspaces]);

  return null;
}

const InspectorPanel: WebPlugin.RightPanel["Render"] = ({
  messages,
  status,
  taskId
}) => (
  <section data-testid="inspector-panel">
    inspector:{taskId}:{status}:{messages.length}
  </section>
);

const RunsPanel: WebPlugin.RightPanel["Render"] = ({
  activeAgent,
  activeWorkspaceId
}) => (
  <section data-testid="runs-panel">
    runs:{activeWorkspaceId}:{activeAgent?.modelId ?? "no-agent"}
  </section>
);
