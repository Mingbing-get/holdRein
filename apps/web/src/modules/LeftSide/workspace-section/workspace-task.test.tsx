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
});

function renderTask({
  hasUnreadCompletion = false,
  status
}: {
  hasUnreadCompletion?: boolean;
  status: WorkspaceTaskSummary["status"];
}) {
  render(
    <WorkspaceTask
      collapsed={false}
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
        status,
        title: "Inspect project"
      }}
    />
  );
}
