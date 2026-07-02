// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppPluginProvider, useAppPlugins } from "../../../app/app-plugin";
import { AppUiProvider } from "../../../app/app-ui-context";
import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../../app/app-workspace-context";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { AgentTasksProvider, useAgentTasks } from ".";
import type { AgentMessageFetcher } from "../api";
import { jsonResponse, startResult, streamResponse } from "./test-utils";

describe("AgentTasksProvider runtime contributions", () => {
  afterEach(() => {
    cleanup();
  });

  it("adds plugin runtime contributions to start task requests", async () => {
    const fetcher = createRuntimeContributionFetcher();

    render(
      <AppUiProvider>
        <AppWorkspaceProvider>
          <AppPluginProvider>
            <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
              <RegisterRuntimePlugin />
              <StartWhenRuntimeContributionsReady />
            </AgentTasksProvider>
          </AppPluginProvider>
        </AppWorkspaceProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(requestBodyFor(fetcher, "/api/v1/agents/start")).toEqual({
        modelId: "gpt-4.1",
        prompt: "Inspect",
        provider: "openai",
        runtimeContributions: expectedRuntimeContributions(),
        workspacePath: "/workspace"
      });
    });
  });

  it("filters plugin runtime contributions by active plugin ids", async () => {
    const fetcher = createRuntimeContributionFetcher();

    render(
      <AppUiProvider>
        <AppWorkspaceProvider>
          <AppPluginProvider>
            <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
              <WorkspaceSettingsSetter />
              <RegisterRuntimePlugin />
              <RegisterDisabledRuntimePlugin />
              <StartWhenRuntimeContributionsReady />
            </AgentTasksProvider>
          </AppPluginProvider>
        </AppWorkspaceProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(requestBodyFor(fetcher, "/api/v1/agents/start")).toEqual({
        modelId: "gpt-4.1",
        prompt: "Inspect",
        provider: "openai",
        runtimeContributions: {
          skills: [
            {
              content: "# Browser Context",
              name: "browser-context"
            }
          ],
          systemPrompts: ["Prefer browser tools."],
          tools: [
            {
              description: "Read selected browser text.",
              inputSchema: { type: "object" },
              name: "read_browser_selection"
            }
          ]
        },
        workspacePath: "/workspace"
      });
    });
  });

  it("adds plugin runtime contributions to continue task requests", async () => {
    const fetcher = createRuntimeContributionFetcher();

    render(
      <AppUiProvider>
        <AppWorkspaceProvider>
          <AppPluginProvider>
            <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
              <RegisterRuntimePlugin />
              <ContinueWhenRuntimeContributionsReady />
            </AgentTasksProvider>
          </AppPluginProvider>
        </AppWorkspaceProvider>
      </AppUiProvider>
    );

    await waitFor(() => {
      expect(
        requestBodyFor(fetcher, "/api/v1/agents/tasks/task-1/continue")
      ).toEqual({
        modelId: "gpt-4.1",
        prompt: "Continue",
        provider: "openai",
        runtimeContributions: expectedRuntimeContributions()
      });
    });
  });
});

function RegisterRuntimePlugin() {
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
            description: "Read selected browser text.",
            executor: () => "Selected text",
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
  }, [pluginRegistry]);

  return null;
}

function RegisterDisabledRuntimePlugin() {
  const { pluginRegistry } = useAppPlugins();

  useEffect(() => {
    const plugin: WebPlugin.Plugin = {
      contributionResolver: {
        skills: [
          {
            content: "# Hidden Context",
            name: "hidden-context"
          }
        ],
        systemPrompts: ["Do not send this prompt."],
        tools: [
          {
            executor: () => "Hidden",
            name: "hidden_browser_tool",
            params: { type: "object" } as WebPlugin.BrowserRuntimeTool["params"]
          }
        ]
      },
      id: "disabled-runtime-demo"
    };

    if (!pluginRegistry.has(plugin.id)) {
      pluginRegistry.register(plugin);
    }
  }, [pluginRegistry]);

  return null;
}

function WorkspaceSettingsSetter() {
  const { setWorkspaceSetting, setWorkspaces } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-1",
        name: "Workspace",
        path: "/workspace",
        tasks: []
      }
    ]);
    setWorkspaceSetting({
      pluginOptions: [],
      setting: { activePlugins: ["runtime-demo"] },
      skillOptions: [],
      workspaceId: "workspace-1"
    });
  }, [setWorkspaceSetting, setWorkspaces]);

  return null;
}

function StartWhenRuntimeContributionsReady() {
  const { runtimeContributions } = useAppPlugins();
  const { startTask } = useAgentTasks();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || runtimeContributions.tools.length === 0) return;
    started.current = true;
    void startTask({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath: "/workspace"
    });
  }, [runtimeContributions.tools.length, startTask]);

  return null;
}

function ContinueWhenRuntimeContributionsReady() {
  const { runtimeContributions } = useAppPlugins();
  const { continueTask } = useAgentTasks();
  const continued = useRef(false);

  useEffect(() => {
    if (continued.current || runtimeContributions.tools.length === 0) return;
    continued.current = true;
    void continueTask("task-1", {
      modelId: "gpt-4.1",
      prompt: "Continue",
      provider: "openai"
    });
  }, [continueTask, runtimeContributions.tools.length]);

  return null;
}

function expectedRuntimeContributions(): WebPlugin.BrowserRuntimeContributions {
  return {
    skills: [
      {
        content: "# Browser Context",
        name: "browser-context"
      }
    ],
    systemPrompts: ["Prefer browser tools."],
    tools: [
      {
        description: "Read selected browser text.",
        inputSchema: { type: "object" },
        name: "read_browser_selection"
      }
    ]
  };
}

function requestBodyFor(
  fetcher: ReturnType<typeof vi.fn>,
  path: string
): unknown {
  const call = fetcher.mock.calls.find(([input]) => String(input) === path);
  if (!call) return undefined;
  const init = call[1] as RequestInit | undefined;
  return typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
}

function createRuntimeContributionFetcher(): AgentMessageFetcher &
  ReturnType<typeof vi.fn> {
  return vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
    }
    if (url.endsWith("/api/v1/agents/tasks/task-1/continue")) {
      return jsonResponse({ ...startResult(), agentId: "agent-2" });
    }
    if (url.endsWith("/title")) {
      return jsonResponse({ id: "task-1", title: "Inspect" });
    }
    return streamResponse(() => undefined);
  });
}
