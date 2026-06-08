// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import { ChatWorkspace } from "./chat-workspace";
import type { SelectedModel } from "./model-selector";

const agentTasksMock = vi.hoisted(() => ({
  startTask: vi.fn()
}));

vi.mock("../agent-messages", () => ({
  AgentMessageList: ({ messages }: { messages: { content: string }[] }) => (
    <div data-testid="agent-message-list">
      {messages.map((message) => message.content).join(",")}
    </div>
  ),
  useAgentTasks: () => ({
    getTaskState: (taskId: string) =>
      taskId === "task-one"
        ? {
            messages: [{ content: "Real message", id: "message-1", kind: "assistant" }]
          }
        : undefined,
    startTask: agentTasksMock.startTask
  })
}));

vi.mock("./sender", () => ({
  default: ({
    disabled,
    footer,
    onSubmit
  }: {
    disabled?: boolean;
    footer?: React.ReactNode;
    onSubmit?: (message: string) => Promise<void>;
  }) => (
    <div>
      <button
        data-testid="sender"
        disabled={disabled}
        onClick={() => void onSubmit?.("Inspect this project")}
      >
        Sender
      </button>
      {footer}
    </div>
  )
}));

vi.mock("./workspace-selector", () => ({
  WorkspaceSelector: () => <div data-testid="workspace-selector" />
}));

vi.mock("./model-selector", () => ({
  ModelSelector: ({
    onChange,
    value
  }: {
    onChange?: (value: SelectedModel) => void;
    value?: SelectedModel;
  }) => (
    <button
      data-testid="model-selector"
      data-model-id={value?.modelId ?? ""}
      data-provider-id={value?.providerId ?? ""}
      onClick={() => {
        onChange?.({
          modelId: "claude-3-5-sonnet",
          providerId: "anthropic"
        });
      }}
    >
      Model selector
    </button>
  )
}));

describe("ChatWorkspace", () => {
  afterEach(() => {
    cleanup();
    agentTasksMock.startTask.mockReset();
  });

  it("disables the sender until both a workspace and model are selected", () => {
    renderChatWorkspace();

    expect(screen.getByTestId("sender")).toBeDisabled();
  });

  it("enables the sender when a workspace and model are selected", () => {
    renderChatWorkspace({
      activeAgent: {
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic"
      },
      activeWorkspaceId: "workspace-one"
    });

    expect(screen.getByTestId("sender")).toBeEnabled();
  });

  it("stores selected models in the workspace context", () => {
    renderChatWorkspace({
      activeWorkspaceId: "workspace-one"
    });

    fireEvent.click(screen.getByTestId("model-selector"));

    expect(screen.getByTestId("sender")).toBeEnabled();
    expect(screen.getByTestId("model-selector")).toHaveAttribute(
      "data-provider-id",
      "anthropic"
    );
    expect(screen.getByTestId("model-selector")).toHaveAttribute(
      "data-model-id",
      "claude-3-5-sonnet"
    );
  });

  it("starts a task and renders messages for the active task", async () => {
    agentTasksMock.startTask.mockResolvedValue(undefined);
    renderChatWorkspace({
      activeAgent: {
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic"
      },
      activeTaskId: "task-one",
      activeWorkspaceId: "workspace-one"
    });

    expect(screen.getByTestId("agent-message-list")).toHaveTextContent(
      "Real message"
    );
    fireEvent.click(screen.getByTestId("sender"));

    expect(agentTasksMock.startTask).toHaveBeenCalledWith({
      modelId: "claude-3-5-sonnet",
      prompt: "Inspect this project",
      provider: "anthropic",
      workspacePath: "/Users/mingbing/apps/workspace-one"
    });
  });
});

interface RenderOptions {
  activeAgent?: SelectedModel;
  activeTaskId?: string;
  activeWorkspaceId?: string;
}

function renderChatWorkspace(options: RenderOptions = {}) {
  render(
    <AppWorkspaceProvider>
      <WorkspaceStateSetup {...options} />
      <ChatWorkspace activeTaskName="Task One" apiBaseUrl="http://localhost:4000" />
    </AppWorkspaceProvider>
  );
}

function WorkspaceStateSetup({
  activeAgent,
  activeTaskId,
  activeWorkspaceId
}: RenderOptions) {
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
        tasks: []
      }
    ]);

    if (activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspaceId);
    }

    if (activeAgent) {
      setActiveAgent(activeAgent);
    }
    if (activeTaskId) {
      setActiveTaskId(activeTaskId);
    }
  }, [
    activeAgent,
    activeTaskId,
    activeWorkspaceId,
    setActiveAgent,
    setActiveTaskId,
    setActiveWorkspaceId,
    setWorkspaces
  ]);

  return null;
}
