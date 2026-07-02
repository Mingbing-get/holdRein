// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkspaceTaskSummary } from "../workspace-nav-types";
import { WorkspaceTask } from "./workspace-task";

describe("WorkspaceTask", () => {
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

  it("shows a spinner for a running task", () => {
    renderTask({ status: "running" });

    expect(screen.getByTestId("task-running-task-one")).toBeInTheDocument();
  });

  it("uses the themed danger color for an error task", () => {
    renderTask({ status: "error" });

    expect(screen.getByTestId("task-title-task-one")).toHaveStyle({
      color: "var(--app-color-danger)"
    });
  });

  it("shows an unread completion dot", () => {
    renderTask({ hasUnreadCompletion: true, status: "completed" });

    expect(screen.getByTestId("task-completed-unread-task-one")).toBeInTheDocument();
  });

  it("shows a pending approval tag before the running spinner", () => {
    renderTask({ hasPendingApproval: true, status: "running" });

    const tag = screen.getByTestId("task-pending-approval-task-one");
    const spinner = screen.getByTestId("task-running-task-one");
    expect(
      tag.compareDocumentPosition(spinner) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it.each([false, true])(
    "shows a clock for a scheduled task when collapsed is %s",
    (collapsed) => {
      renderTask({ collapsed, sourceType: "scheduled", status: "completed" });

      expect(screen.getByTestId("task-scheduled-task-one")).toBeInTheDocument();
    }
  );

  it("does not show a clock for a manual task", () => {
    renderTask({ sourceType: "manual", status: "completed" });

    expect(screen.queryByTestId("task-scheduled-task-one")).toBeNull();
  });
});

function renderTask({
  collapsed = false,
  hasPendingApproval = false,
  hasUnreadCompletion = false,
  sourceType = "manual",
  status
}: {
  collapsed?: boolean;
  hasPendingApproval?: boolean;
  hasUnreadCompletion?: boolean;
  sourceType?: WorkspaceTaskSummary["sourceType"];
  status: WorkspaceTaskSummary["status"];
}) {
  render(
    <WorkspaceTask
      collapsed={collapsed}
      hasPendingApproval={hasPendingApproval}
      hasUnreadCompletion={hasUnreadCompletion}
      isActive={false}
      onDelete={vi.fn()}
      onOpen={vi.fn()}
      onRename={vi.fn()}
      task={{
        id: "task-one",
        initialUserMessage: "Inspect",
        lastContinuedAt: "2026-06-11T00:00:00.000Z",
        lastModelName: "gpt-4.1",
        lastModelProvider: "openai",
        lastModelProviderSource: "built_in",
        sourceMark: sourceType === "scheduled" ? "scheduled-task-one" : null,
        sourceType,
        status,
        title: "Inspect project"
      }}
    />
  );
}
