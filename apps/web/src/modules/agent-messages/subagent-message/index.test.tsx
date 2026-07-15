// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubagentMessageList } from "./index";
import type { WebPlugin } from "@hold-rein/plugin-web";

const agentTasksMock = vi.hoisted(() => ({
  messages: {} as Record<string, WebPlugin.AgentMessage[]>,
  statuses: {} as Record<string, "running" | "completed" | undefined>
}));

vi.mock("@ant-design/icons", () => ({
  BranchesOutlined: () => <span data-testid="branches-icon" />
}));

vi.mock("@ant-design/x", () => ({
  Think: ({
    children,
    loading
  }: PropsWithChildren<{ loading?: boolean }>) => (
    <section data-loading={String(Boolean(loading))} data-testid="think">
      {children}
    </section>
  )
}));

vi.mock("../tasks-context", () => ({
  useAgentMessages: (agentId: string) =>
    agentTasksMock.messages[agentId] ?? [],
  useAgentTasks: () => ({
    getSubagentStatus: (agentId: string) => agentTasksMock.statuses[agentId]
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
    agentTasksMock.statuses = {};
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
