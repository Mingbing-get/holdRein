// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChatWorkspace } from "./chat-workspace";

const taskMessages = [
  { content: "Question", id: "user-1", role: "user", timestamp: 1 }
];
let receivedScrollContainerRef: RefObject<HTMLDivElement | null> | undefined;

vi.mock("../../app/app-workspace-context", () => ({
  useAppWorkspace: () => ({
    setActiveAgent: vi.fn(),
    state: {
      activeAgent: undefined,
      activeTaskId: "task-1",
      activeWorkspaceId: "workspace-1",
      workspaces: [
        {
          id: "workspace-1",
          path: "/tmp/workspace",
          tasks: [{ id: "task-1" }]
        }
      ]
    }
  })
}));

vi.mock("../agent-messages", () => ({
  AgentMessageList: () => <div data-testid="agent-message-list" />,
  ApprovalPanel: () => null,
  useAgentTasks: () => ({
    cancelTask: vi.fn(),
    continueTask: vi.fn(),
    decideApproval: vi.fn(),
    getPendingApproval: () => undefined,
    getTaskState: () => ({ messages: taskMessages, status: "completed" }),
    startTask: vi.fn()
  })
}));

vi.mock("./sender", () => ({ default: () => <div data-testid="sender" /> }));
vi.mock("./use-workspace-file-suggestions", () => ({
  useWorkspaceFileSuggestions: () => []
}));
vi.mock("./user-message-navigator", () => ({
  UserMessageNavigator: ({ messages, scrollContainerRef }: {
    messages: typeof taskMessages;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
  }) => {
    receivedScrollContainerRef = scrollContainerRef;
    return (
      <div
        data-message-count={messages.length}
        data-testid="user-message-navigator"
      />
    );
  }
}));

describe("ChatWorkspace user message navigator", () => {
  it("overlays the navigator beside the message scroll viewport", () => {
    render(<ChatWorkspace activeTaskName="Task" apiBaseUrl="/api" />);

    const scrollViewport = screen.getByTestId("chat-message-scroll");
    const navigator = screen.getByTestId("user-message-navigator");

    expect(navigator).toHaveAttribute("data-message-count", "1");
    expect(receivedScrollContainerRef?.current).toBe(scrollViewport);
    expect(navigator.parentElement).toBe(scrollViewport.parentElement);
  });
});
