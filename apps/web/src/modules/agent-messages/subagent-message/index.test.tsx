// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubagentMessageList } from "./index";
import type { WebPlugin } from "@hold-rein/plugin-web";

const agentTasksMock = vi.hoisted(() => ({
  messages: {} as Record<string, WebPlugin.AgentMessage[]>,
  names: {} as Record<string, string | undefined>,
  statuses: {} as Record<string, "running" | "completed" | undefined>
}));

vi.mock("@ant-design/icons", () => ({
  BranchesOutlined: () => <span data-testid="branches-icon" />
}));

vi.mock("@ant-design/x", () => ({
  Think: ({
    children,
    loading,
    title
  }: PropsWithChildren<{ loading?: boolean; title?: string }>) => (
    <section
      data-loading={String(Boolean(loading))}
      data-testid="think"
      data-title={title}
    >
      {children}
    </section>
  )
}));

vi.mock("../tasks-context", () => ({
  useAgentMessages: (agentId: string) =>
    agentTasksMock.messages[agentId] ?? [],
  useAgentTasks: () => ({
    getSubagent: (agentId: string) =>
      agentTasksMock.statuses[agentId] === undefined
        ? undefined
        : {
            agentName: agentTasksMock.names[agentId],
            status: agentTasksMock.statuses[agentId]
          }
  })
}));

vi.mock("../message-list", () => ({
  AgentMessageList: ({ agentId }: { agentId: string }) => (
    <div data-testid="messages">
      {(agentTasksMock.messages[agentId] ?? []).length}
    </div>
  )
}));

describe("SubagentMessageList", () => {
  afterEach(() => {
    cleanup();
    agentTasksMock.messages = {};
    agentTasksMock.names = {};
    agentTasksMock.statuses = {};
  });

  it("renders the subagent name in the title", () => {
    agentTasksMock.names["agent-child"] = "Code Reviewer";
    agentTasksMock.statuses["agent-child"] = "running";

    render(<SubagentMessageList agentId="agent-child" />);

    expect(screen.getByTestId("think")).toHaveAttribute(
      "data-title",
      "调用子智能体：Code Reviewer"
    );
  });

  it("sets Think loading while the subagent is running", () => {
    agentTasksMock.statuses["agent-child"] = "running";

    render(<SubagentMessageList agentId="agent-child" />);

    expect(screen.getByTestId("think")).toHaveAttribute(
      "data-loading",
      "true"
    );
  });

  it("does not set Think loading after the subagent completes", () => {
    agentTasksMock.statuses["agent-child"] = "completed";

    render(<SubagentMessageList agentId="agent-child" />);

    expect(screen.getByTestId("think")).toHaveAttribute(
      "data-loading",
      "false"
    );
  });
});
