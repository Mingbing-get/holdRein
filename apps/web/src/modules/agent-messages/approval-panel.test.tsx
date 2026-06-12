// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { App } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PendingApproval } from "./agent-message-types";
import { ApprovalPanel } from "./approval-panel";

const approval: PendingApproval = {
  agentId: "agent-1",
  approvalId: "approval-1",
  title: "允许插件修改工作区？",
  tool: {
    description: "Apply the requested workspace change",
    input: { file: "src/index.ts" },
    name: "workspace_patch",
    toolCallId: "tool-call-1"
  }
};

describe("ApprovalPanel", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {
          return undefined;
        }
        observe() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
      }
    );
  });

  afterEach(cleanup);

  it("submits accept and reject decisions", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    renderPanel(onDecide);

    fireEvent.click(screen.getByRole("button", { name: /同\s*意/ }));
    await waitFor(() => {
      expect(onDecide).toHaveBeenCalledWith(true, undefined);
    });

    fireEvent.change(screen.getByRole("textbox", { name: "拒绝原因" }), {
      target: { value: "Use a safer command" }
    });
    fireEvent.click(screen.getByRole("button", { name: /拒\s*绝/ }));
    await waitFor(() => {
      expect(onDecide).toHaveBeenLastCalledWith(false, "Use a safer command");
    });
  });

  it("renders as a sticky bottom overlay without a dark accept button", () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    renderPanel(onDecide);

    const panel = screen.getByTestId("approval-panel");
    expect(panel).toHaveStyle({
      bottom: "0px",
      position: "sticky"
    });
    expect(panel.style.borderStyle).toBe("none");
    expect(panel.style.boxShadow).toBe("0 0px 10px var(--app-color-shadow)");

    const acceptButton = screen.getByRole("button", { name: /同\s*意/ });
    expect(acceptButton).not.toHaveClass("ant-btn-color-primary");
    expect(acceptButton).toHaveStyle({
      background: "transparent",
      color: "var(--app-color-success)"
    });
    expect(acceptButton.style.borderColor).toBe("var(--app-color-success)");
  });

  it("renders a custom title or falls back to the tool name", () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    renderPanel(onDecide);

    expect(screen.getByText("允许插件修改工作区？")).toBeInTheDocument();

    cleanup();
    const approvalWithoutTitle: PendingApproval = {
      agentId: approval.agentId,
      approvalId: approval.approvalId,
      tool: approval.tool
    };
    renderPanel(onDecide, approvalWithoutTitle);

    expect(
      screen.getByText("是否允许执行 workspace_patch tool？")
    ).toBeInTheDocument();
  });

  it("rejects on Enter and allows Shift+Enter to add a newline", async () => {
    const onDecide = vi.fn().mockResolvedValue(undefined);
    renderPanel(onDecide);
    const input = screen.getByRole("textbox", { name: "拒绝原因" });

    fireEvent.change(input, { target: { value: "Not now" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onDecide).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(onDecide).toHaveBeenCalledWith(false, "Not now");
    });
  });
});

function renderPanel(
  onDecide: (approved: boolean, reason?: string) => Promise<void>,
  approvalInput: PendingApproval = approval
) {
  render(
    <App>
      <ApprovalPanel approval={approvalInput} onDecide={onDecide} />
    </App>
  );
}
