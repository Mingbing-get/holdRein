// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentMessageList } from ".";
import type { WebPlugin } from "@hold-rein/plugin-web";

const agentTasksMock = vi.hoisted(() => ({
  taskMessages: [] as WebPlugin.AgentMessage[]
}));

vi.mock("../../../app/app-workspace-context", () => ({
  useAppWorkspace: () => ({
    state: { activeWorkspaceId: "", workspaces: [] }
  })
}));

vi.mock("../tasks-context", () => ({
  useAgentMessage: (_agentId: string, messageId: string) =>
    agentTasksMock.taskMessages.find((message) => message.id === messageId),
  useAgentMessages: () => agentTasksMock.taskMessages,
  useToolResultMessage: (_agentId: string, toolCallId: string) =>
    agentTasksMock.taskMessages.find(
      (message): message is WebPlugin.ToolResultMessage =>
        message.role === "toolResult" && message.toolCallId === toolCallId
    )
}));

vi.mock("../../../app/app-plugin", () => ({
  useAppPlugins: () => ({ toolRenders: [], turnFooterRenders: [] })
}));

describe("AgentMessageList user anchors", () => {
  afterEach(() => {
    cleanup();
    agentTasksMock.taskMessages = [];
  });

  it("anchors visible non-empty user messages only", () => {
    agentTasksMock.taskMessages = [
      {
        content: "Navigate here",
        id: "user-visible",
        role: "user",
        timestamp: 1
      },
      { content: "", id: "user-empty", role: "user", timestamp: 2 }
    ];

    render(<AgentMessageList agentId="agent-main" />);

    expect(screen.getByText("Navigate here").closest("[data-user-message-id]"))
      .toHaveAttribute("data-user-message-id", "user-visible");
    expect(document.querySelector('[data-user-message-id="user-empty"]'))
      .not.toBeInTheDocument();
  });
});
