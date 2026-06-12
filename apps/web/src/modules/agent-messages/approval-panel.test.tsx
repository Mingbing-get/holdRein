// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { App } from "antd";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApprovalPanel } from "./approval-panel";

const approval = {
  agentId: "agent-1",
  approvalId: "approval-1",
  command: "rm -rf dist",
  cwd: "/workspace",
  risk: "dangerous" as const
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

function renderPanel(onDecide: (approved: boolean, reason?: string) => Promise<void>) {
  render(
    <App>
      <ApprovalPanel approval={approval} onDecide={onDecide} />
    </App>
  );
}
