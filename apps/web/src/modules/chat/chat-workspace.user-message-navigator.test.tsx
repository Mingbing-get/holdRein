// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChatWorkspace } from "./chat-workspace";

const taskMessages = [
  { content: "Question", id: "user-1", role: "user", timestamp: 1 }
];
let receivedAgentId: string | undefined;
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
          tasks: [{ activeAgentId: "agent-1", id: "task-1" }]
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
  }),
  useAgentMessages: () => taskMessages
}));

vi.mock("./sender", () => ({ default: () => <div data-testid="sender" /> }));
vi.mock("./use-workspace-file-suggestions", () => ({
  useWorkspaceFileSuggestions: () => []
}));
vi.mock("./user-message-navigator", () => ({
  UserMessageNavigator: ({ agentId, scrollContainerRef }: {
    agentId: string;
    scrollContainerRef: RefObject<HTMLDivElement | null>;
  }) => {
    receivedAgentId = agentId;
    receivedScrollContainerRef = scrollContainerRef;
    return <div data-testid="user-message-navigator" />;
  }
}));

describe("ChatWorkspace user message navigator", () => {
  it("overlays the navigator beside the message scroll viewport", () => {
    render(<ChatWorkspace activeTaskName="Task" apiBaseUrl="/api" />);

    const scrollViewport = screen.getByTestId("chat-message-scroll");
    const navigator = screen.getByTestId("user-message-navigator");

    expect(receivedAgentId).toBe("task-1");
    expect(receivedScrollContainerRef?.current).toBe(scrollViewport);
    expect(navigator.parentElement).toBe(scrollViewport.parentElement);
  });
});
