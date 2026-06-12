// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppWorkspaceProvider,
  useAppWorkspace
} from "../../app/app-workspace-context";
import type { PendingApproval } from "../agent-messages";
import { ChatWorkspace } from "./chat-workspace";
import type { SelectedModel } from "./model-selector";

const agentTasksMock = vi.hoisted(() => ({
  continueTask: vi.fn(),
  decideApproval: vi.fn(),
  messages: [
    { content: "Real message", id: "message-1", kind: "assistant" }
  ] as { content: string; id: string; kind: string }[],
  pendingApproval: undefined as PendingApproval | undefined,
  startTask: vi.fn()
}));

vi.mock("../agent-messages", () => ({
  ApprovalPanel: () => <div data-testid="approval-panel">Approval</div>,
  AgentMessageList: ({ messages }: { messages: { content: string }[] }) => (
    <div data-testid="agent-message-list">
      {messages.map((message) => message.content).join(",")}
    </div>
  ),
  useAgentTasks: () => ({
    continueTask: agentTasksMock.continueTask,
    decideApproval: agentTasksMock.decideApproval,
    getPendingApproval: () => agentTasksMock.pendingApproval,
    getTaskState: (taskId: string) =>
      taskId === "task-one"
        ? {
            messages: agentTasksMock.messages
          }
        : undefined,
    startTask: agentTasksMock.startTask
  })
}));

vi.mock("./sender", () => ({
  default: ({
    activeAgent,
    apiBaseUrl,
    disabled,
    onActiveAgentChange,
    onSubmit
  }: {
    activeAgent?: SelectedModel;
    apiBaseUrl: string;
    disabled?: boolean;
    onActiveAgentChange?: (value: SelectedModel) => void;
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
      <div data-api-base-url={apiBaseUrl} data-testid="workspace-selector" />
      <button
        data-testid="model-selector"
        data-model-id={activeAgent?.modelId ?? ""}
        data-provider-id={activeAgent?.providerId ?? ""}
        onClick={() => {
          onActiveAgentChange?.({
            modelId: "claude-3-5-sonnet",
            providerId: "anthropic"
          });
        }}
      >
        Model selector
      </button>
    </div>
  )
}));

describe("ChatWorkspace", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
  });

  afterEach(() => {
    cleanup();
    agentTasksMock.startTask.mockReset();
    agentTasksMock.continueTask.mockReset();
    agentTasksMock.decideApproval.mockReset();
    agentTasksMock.pendingApproval = undefined;
    agentTasksMock.messages = [
      { content: "Real message", id: "message-1", kind: "assistant" }
    ];
    scrollIntoView.mockReset();
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
    agentTasksMock.continueTask.mockResolvedValue(undefined);
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

    expect(agentTasksMock.continueTask).toHaveBeenCalledWith(
      "task-one",
      {
        modelId: "claude-3-5-sonnet",
        prompt: "Inspect this project",
        provider: "anthropic"
      }
    );
  });

  it("renders a pending approval after the message list", () => {
    agentTasksMock.pendingApproval = {
      agentId: "agent-1",
      approvalId: "approval-1",
      tool: {
        input: {},
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    };
    renderChatWorkspace({ activeTaskId: "task-one" });

    const messageList = screen.getByTestId("agent-message-list");
    const approvalPanel = screen.getByTestId("approval-panel");
    expect(
      messageList.compareDocumentPosition(approvalPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("uses the message scroll area as the approval overlay container", () => {
    agentTasksMock.pendingApproval = {
      agentId: "agent-1",
      approvalId: "approval-1",
      tool: {
        input: {},
        name: "workspace_patch",
        toolCallId: "tool-call-1"
      }
    };
    renderChatWorkspace({ activeTaskId: "task-one" });

    expect(screen.getByTestId("chat-message-scroll")).toHaveStyle({
      position: "relative"
    });
  });

  it("starts a new task when no task is active", () => {
    agentTasksMock.startTask.mockResolvedValue(undefined);
    renderChatWorkspace({
      activeAgent: {
        modelId: "claude-3-5-sonnet",
        providerId: "anthropic"
      },
      activeWorkspaceId: "workspace-one"
    });

    fireEvent.click(screen.getByTestId("sender"));

    expect(agentTasksMock.startTask).toHaveBeenCalledWith({
      modelId: "claude-3-5-sonnet",
      prompt: "Inspect this project",
      provider: "anthropic",
      workspacePath: "/Users/mingbing/apps/workspace-one"
    });
    expect(agentTasksMock.continueTask).not.toHaveBeenCalled();
  });

  it("scrolls to the bottom when entering a task", async () => {
    renderChatWorkspace({ activeTaskId: "task-one" });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("keeps scrolling to the bottom as messages update", async () => {
    const view = renderChatWorkspace({ activeTaskId: "task-one" });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    scrollIntoView.mockClear();
    agentTasksMock.messages = [
      ...agentTasksMock.messages,
      { content: "New message", id: "message-2", kind: "assistant" }
    ];
    view.rerender(getChatWorkspaceElement({ activeTaskId: "task-one" }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("pauses following after a trusted user scrolls away and resumes at the bottom", async () => {
    const view = renderChatWorkspace({ activeTaskId: "task-one" });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    const container = screen.getByTestId("chat-message-scroll");
    setScrollPosition(container, { clientHeight: 100, scrollHeight: 300, scrollTop: 50 });
    dispatchScroll(container, true);
    scrollIntoView.mockClear();
    agentTasksMock.messages = [
      ...agentTasksMock.messages,
      { content: "Paused message", id: "message-2", kind: "assistant" }
    ];
    view.rerender(getChatWorkspaceElement({ activeTaskId: "task-one" }));

    await waitFor(() => {
      expect(screen.getByTestId("agent-message-list")).toHaveTextContent(
        "Paused message"
      );
    });
    expect(scrollIntoView).not.toHaveBeenCalled();

    setScrollPosition(container, { clientHeight: 100, scrollHeight: 300, scrollTop: 200 });
    dispatchScroll(container, true);
    agentTasksMock.messages = [
      ...agentTasksMock.messages,
      { content: "Following message", id: "message-3", kind: "assistant" }
    ];
    view.rerender(getChatWorkspaceElement({ activeTaskId: "task-one" }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("starts following again when switching tasks", async () => {
    const view = renderChatWorkspace({ activeTaskId: "task-one" });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    const container = screen.getByTestId("chat-message-scroll");
    setScrollPosition(container, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 50
    });
    dispatchScroll(container, true);
    scrollIntoView.mockClear();

    view.rerender(getChatWorkspaceElement({ activeTaskId: "task-two" }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("ignores programmatic scroll events when deciding whether to follow", async () => {
    const view = renderChatWorkspace({ activeTaskId: "task-one" });

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    const container = screen.getByTestId("chat-message-scroll");
    setScrollPosition(container, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 50
    });
    dispatchScroll(container, false);
    scrollIntoView.mockClear();
    agentTasksMock.messages = [
      ...agentTasksMock.messages,
      { content: "Programmatic message", id: "message-2", kind: "assistant" }
    ];
    view.rerender(getChatWorkspaceElement({ activeTaskId: "task-one" }));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });
});

interface RenderOptions {
  activeAgent?: SelectedModel;
  activeTaskId?: string;
  activeWorkspaceId?: string;
}

function renderChatWorkspace(options: RenderOptions = {}) {
  return render(getChatWorkspaceElement(options));
}

function getChatWorkspaceElement(options: RenderOptions = {}) {
  return (
    <AppWorkspaceProvider>
      <WorkspaceStateSetup {...options} />
      <ChatWorkspace activeTaskName="Task One" apiBaseUrl="http://localhost:4000" />
    </AppWorkspaceProvider>
  );
}

function dispatchScroll(element: HTMLElement, isTrusted: boolean) {
  const reactPropsKey = Object.keys(element).find((key) =>
    key.startsWith("__reactProps$")
  );
  if (!reactPropsKey) {
    throw new Error("React props were not found on the scroll container");
  }
  const props = (
    element as unknown as Record<
      string,
      { onScroll?: (event: React.UIEvent<HTMLDivElement>) => void }
    >
  )[reactPropsKey];

  act(() => {
    props?.onScroll?.({
      currentTarget: element,
      isTrusted
    } as React.UIEvent<HTMLDivElement>);
  });
}

function setScrollPosition(
  element: HTMLElement,
  position: { clientHeight: number; scrollHeight: number; scrollTop: number }
) {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: position.clientHeight },
    scrollHeight: { configurable: true, value: position.scrollHeight },
    scrollTop: { configurable: true, value: position.scrollTop, writable: true }
  });
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
