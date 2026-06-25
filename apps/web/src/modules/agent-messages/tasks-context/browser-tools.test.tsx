// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppWorkspaceProvider } from "../../../app/app-workspace-context";
import type { AgentMessageFetcher } from "../api";
import {
  clearBrowserToolExecutorsForTests,
  registerBrowserToolExecutor
} from "../browser-tools";
import { AgentTasksProvider, useAgentTasks } from ".";
import { jsonResponse, startResult, streamResponse } from "./test-utils";

describe("AgentTasksProvider browser tools", () => {
  afterEach(() => {
    clearBrowserToolExecutorsForTests();
    cleanup();
  });

  it("executes registered browser tools and submits the result", async () => {
    const executor = vi.fn().mockResolvedValue("Selected text");
    registerBrowserToolExecutor("read_browser_selection", executor);
    const fetcher = createBrowserToolFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <StartTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(executor).toHaveBeenCalledWith(
        expect.objectContaining({
          arguments: { scope: "selection" },
          toolCallId: "tool-call-1",
          toolName: "read_browser_selection"
        })
      );
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/agents/agent-1/browser-tools/tool-call-1/result",
        expect.objectContaining({
          body: JSON.stringify({ content: "Selected text", isError: false })
        })
      );
    });
  });

  it("submits an error result when no browser executor is registered", async () => {
    const fetcher = createBrowserToolFetcher();

    render(
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl="" fetcher={fetcher}>
          <StartTaskProbe />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith(
        "/api/v1/agents/agent-1/browser-tools/tool-call-1/result",
        expect.objectContaining({
          body: JSON.stringify({
            content: "No browser executor registered for read_browser_selection.",
            isError: true
          })
        })
      );
    });
  });
});

function StartTaskProbe() {
  const { startTask } = useAgentTasks();

  useEffect(() => {
    void startTask({
      modelId: "gpt-4.1",
      prompt: "Inspect",
      provider: "openai",
      workspacePath: "/workspace"
    });
  }, [startTask]);

  return null;
}

function createBrowserToolFetcher(): AgentMessageFetcher & ReturnType<typeof vi.fn> {
  const encoder = new TextEncoder();

  return vi.fn(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/agents/start")) {
      return jsonResponse(startResult());
    }
    if (url.endsWith("/api/v1/agents/agent-1/events")) {
      return streamResponse((controller) => {
        controller.enqueue(encoder.encode(`${JSON.stringify({
          agentId: "agent-1",
          payload: {
            arguments: { scope: "selection" },
            toolCallId: "tool-call-1",
            toolName: "read_browser_selection"
          },
          sequence: 1,
          timestamp: "2026-06-25T00:00:00.000Z",
          type: "browser_tool_call_requested"
        })}\n`));
        controller.close();
      });
    }
    if (url.endsWith("/browser-tools/tool-call-1/result")) {
      return jsonResponse({
        agentId: "agent-1",
        content: "ok",
        toolCallId: "tool-call-1"
      });
    }
    return jsonResponse({ id: "task-1", title: "Inspect" });
  });
}
