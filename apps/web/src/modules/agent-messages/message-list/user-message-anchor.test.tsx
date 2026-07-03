// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentMessageList } from ".";

vi.mock("../../../app/app-workspace-context", () => ({
  useAppWorkspace: () => ({
    state: { activeWorkspaceId: "", workspaces: [] }
  })
}));

vi.mock("../../../app/app-plugin", () => ({
  useAppPlugins: () => ({ toolRenders: [], turnFooterRenders: [] })
}));

describe("AgentMessageList user anchors", () => {
  afterEach(cleanup);

  it("anchors visible non-empty user messages only", () => {
    render(
      <AgentMessageList
        messages={[
          {
            content: "Navigate here",
            id: "user-visible",
            role: "user",
            timestamp: 1
          },
          { content: "", id: "user-empty", role: "user", timestamp: 2 }
        ]}
      />
    );

    expect(screen.getByText("Navigate here").closest("[data-user-message-id]"))
      .toHaveAttribute("data-user-message-id", "user-visible");
    expect(document.querySelector('[data-user-message-id="user-empty"]'))
      .not.toBeInTheDocument();
  });
});
