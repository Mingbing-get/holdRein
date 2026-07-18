// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import { ChatWorkspace } from "./chat-workspace";
import type { SelectedModel } from "./model-selector";

vi.mock("../agent-messages", () => ({
  ApprovalPanel: () => null,
  AgentMessageList: () => <div data-testid="agent-message-list" />,
  useAgentTasks: () => ({
    cancelTask: vi.fn(),
    continueTask: vi.fn(),
    decideApproval: vi.fn(),
    getPendingApproval: () => undefined,
    getTaskState: () => undefined,
    startTask: vi.fn()
  }),
  useAgentMessages: () => []
}));

vi.mock("./sender", () => ({
  default: ({ activeAgent }: { activeAgent?: SelectedModel | null }) => (
    <div
      data-input={(activeAgent?.input ?? []).join(",")}
      data-model-id={activeAgent?.modelId ?? ""}
      data-provider-id={activeAgent?.providerId ?? ""}
      data-testid="sender-model"
    />
  )
}));

vi.mock("../model-providers/model-provider-api", () => ({
  fetchCachedProviderModels: vi.fn(async (_apiBaseUrl: string, providerId: string) =>
    providerId === "local"
      ? [
          {
            api: "openai",
            contextWindow: 128000,
            id: "coding-agent",
            input: ["text", "image"],
            maxTokens: 4096,
            name: "Coding Agent",
            provider: "local",
            reasoning: true
          }
        ]
      : []
  )
}));

vi.mock("./use-workspace-file-suggestions", () => ({
  useWorkspaceFileSuggestions: () => []
}));

afterEach(() => {
  cleanup();
});

describe("ChatWorkspace task model restoration", () => {
  it("restores the active sender model from the selected task", async () => {
    render(
      <AppWorkspaceProvider>
        <WorkspaceStateSetup />
        <ChatWorkspace activeTaskName="Task Two" apiBaseUrl="http://localhost:4000" />
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sender-model")).toHaveAttribute(
        "data-provider-id",
        "local"
      );
    });
    expect(screen.getByTestId("sender-model")).toHaveAttribute(
      "data-model-id",
      "coding-agent"
    );
  });

  it("restores selected task model input capabilities for the sender", async () => {
    render(
      <AppWorkspaceProvider>
        <WorkspaceStateSetup />
        <ChatWorkspace activeTaskName="Task Two" apiBaseUrl="http://localhost:4000" />
      </AppWorkspaceProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("sender-model")).toHaveAttribute(
        "data-input",
        "text,image"
      );
    });
  });
});

function WorkspaceStateSetup() {
  const {
    setActiveAgent,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  } = useAppWorkspace();

  useEffect(() => {
    setWorkspaces([
      {
        hasMore: false,
        id: "workspace-one",
        name: "Workspace One",
        path: "/Users/mingbing/apps/workspace-one",
        tasks: [
          {
            id: "task-one",
            initialUserMessage: "First task",
            lastContinuedAt: "2026-06-23T00:00:00.000Z",
            lastModelId: "gpt-4.1",
            lastModelName: "GPT 4.1",
            lastModelProvider: "openai",
            lastModelProviderSource: "built_in",
            status: "completed",
            title: "Task One"
          },
          {
            id: "task-two",
            initialUserMessage: "Second task",
            lastContinuedAt: "2026-06-24T00:00:00.000Z",
            lastModelId: "coding-agent",
            lastModelName: "Coding Agent",
            lastModelProvider: "local",
            lastModelProviderSource: "custom",
            status: "completed",
            title: "Task Two"
          }
        ]
      }
    ]);
    setActiveWorkspaceId("workspace-one");
    setActiveAgent({
      modelId: "gpt-4.1",
      providerId: "openai"
    });
    setActiveTaskId("task-two");
  }, [
    setActiveAgent,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  ]);

  return null;
}
